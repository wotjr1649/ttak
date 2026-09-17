using System;
using System.IO;
using System.Text;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Win32.SafeHandles;

// Fixed supervisor compiled in memory by PowerShell. Child code starts only after job assignment.
public static class TtakWindowsJob {
    [StructLayout(LayoutKind.Sequential)] struct SA { public int size; public IntPtr descriptor; public int inherit; }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct SI {
        public int size; public string reserved, desktop, title;
        public int x,y,dx,dy,cx,cy,fill,flags; public short show, reservedSize;
        public IntPtr reservedBytes, stdin, stdout, stderr;
    }
    [StructLayout(LayoutKind.Sequential)] struct PI { public IntPtr process, thread; public uint pid, tid; }
    [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
        public long processTime, jobTime; public uint flags; public UIntPtr minWorking, maxWorking;
        public uint activeLimit; public UIntPtr affinity; public uint priority, scheduling;
    }
    [StructLayout(LayoutKind.Sequential)] struct IO { public ulong rOps,wOps,oOps,rBytes,wBytes,oBytes; }
    [StructLayout(LayoutKind.Sequential)] struct Limits {
        public BasicLimits basic; public IO io; public UIntPtr processMemory, jobMemory, peakProcess, peakJob;
    }
    [StructLayout(LayoutKind.Sequential)] struct Accounting {
        public long user, kernel, periodUser, periodKernel; public uint faults,total,active,terminated;
    }
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool CreatePipe(out IntPtr read, out IntPtr write, ref SA attributes, uint size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes,string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int cls,ref Limits info,int length);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int cls,out Accounting info,int length,IntPtr returned);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint code);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint code);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(
        string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref SI startup,out PI process);

    public class Result {
        public string status, stdout, stderr;
        public uint pid, exitCode, activeProcesses, totalProcesses;
        public bool assignedBeforeResume, cleanupVerified;
        public long elapsedMs;
    }
    static void Check(bool ok) { if (!ok) throw new InvalidOperationException("win32_"+Marshal.GetLastWin32Error()); }
    static void Close(ref IntPtr value) { if(value!=IntPtr.Zero) { CloseHandle(value); value=IntPtr.Zero; } }
    static string Quote(string arg) {
        if(arg==null || arg.IndexOf('\0')>=0) throw new ArgumentException("invalid_argument");
        var s=new StringBuilder("\""); int slashes=0;
        foreach(char c in arg) {
            if(c=='\\') { slashes++; continue; }
            if(c=='\"') { s.Append('\\',slashes*2+1); s.Append(c); }
            else { s.Append('\\',slashes); s.Append(c); }
            slashes=0;
        }
        s.Append('\\',slashes*2); return s.Append('"').ToString();
    }
    static byte[] ReadBounded(FileStream stream,int cap,Action overflow) {
        using(stream) using(var output=new MemoryStream()) {
            var buffer=new byte[4096]; int count;
            while((count=stream.Read(buffer,0,buffer.Length))!=0) {
                if(output.Length+count>cap) { overflow(); return new byte[0]; }
                output.Write(buffer,0,count);
            }
            return output.ToArray();
        }
    }
    public static Result Run(string executable,string[] args,string cwd,string input,int timeoutMs,int outLimit,int errLimit,int cleanupMs) {
        if(!Path.IsPathFullyQualified(executable) || !Path.IsPathFullyQualified(cwd) ||
           timeoutMs<50 || timeoutMs>2147450000 || outLimit<1 || outLimit>1048576 ||
           errLimit<1 || errLimit>65536 || cleanupMs<100 || cleanupMs>10000 ||
           input==null || Encoding.UTF8.GetByteCount(input)>1048576) throw new ArgumentException("invalid_limits");
        var command=new StringBuilder(Quote(executable));
        foreach(var arg in args) command.Append(' ').Append(Quote(arg));
        if(command.Length>=32767) throw new ArgumentException("command_too_long");
        IntPtr job=IntPtr.Zero,ir=IntPtr.Zero,iw=IntPtr.Zero,or=IntPtr.Zero,ow=IntPtr.Zero,er=IntPtr.Zero,ew=IntPtr.Zero;
        PI process=new PI(); bool assigned=false, finished=false;
        var result=new Result{status="supervisor_error",stdout="",stderr=""};
        var clock=Stopwatch.StartNew();
        try {
            job=CreateJobObject(IntPtr.Zero,null); Check(job!=IntPtr.Zero);
            var limits=new Limits(); limits.basic.flags=0x2000; // KILL_ON_JOB_CLOSE; no breakaway flag.
            Check(SetInformationJobObject(job,9,ref limits,Marshal.SizeOf<Limits>()));
            var sa=new SA{size=Marshal.SizeOf<SA>(),inherit=1};
            Check(CreatePipe(out ir,out iw,ref sa,0)); Check(SetHandleInformation(iw,1,0));
            Check(CreatePipe(out or,out ow,ref sa,0)); Check(SetHandleInformation(or,1,0));
            Check(CreatePipe(out er,out ew,ref sa,0)); Check(SetHandleInformation(er,1,0));
            var startup=new SI{size=Marshal.SizeOf<SI>(),flags=0x101,show=0,stdin=ir,stdout=ow,stderr=ew};
            // CREATE_SUSPENDED | CREATE_NO_WINDOW; inherit only our inheritable pipe endpoints.
            Check(CreateProcess(executable,command,IntPtr.Zero,IntPtr.Zero,true,0x08000004,IntPtr.Zero,cwd,ref startup,out process));
            result.pid=process.pid;
            Check(AssignProcessToJobObject(job,process.process)); assigned=true;
            result.assignedBeforeResume=true;
            Close(ref ir); Close(ref ow); Close(ref ew);
            int overflow=0;
            var output=new FileStream(new SafeFileHandle(or,true),FileAccess.Read); or=IntPtr.Zero;
            var errors=new FileStream(new SafeFileHandle(er,true),FileAccess.Read); er=IntPtr.Zero;
            var writer=new FileStream(new SafeFileHandle(iw,true),FileAccess.Write); iw=IntPtr.Zero;
            var outTask=Task.Run(()=>ReadBounded(output,outLimit,()=>Interlocked.Exchange(ref overflow,1)));
            var errTask=Task.Run(()=>ReadBounded(errors,errLimit,()=>Interlocked.Exchange(ref overflow,2)));
            if(ResumeThread(process.thread)==UInt32.MaxValue) throw new InvalidOperationException("resume_failed");
            var writeTask=Task.Run(()=>{using(writer){var bytes=Encoding.UTF8.GetBytes(input); writer.Write(bytes,0,bytes.Length);}});
            while(true) {
                if(Volatile.Read(ref overflow)!=0) { result.status="output_limit"; break; }
                if(outTask.IsFaulted || errTask.IsFaulted || writeTask.IsFaulted) { result.status="pipe_error"; break; }
                uint state=WaitForSingleObject(process.process,10);
                if(state==0) { Check(GetExitCodeProcess(process.process,out result.exitCode)); result.status="exited"; break; }
                if(state!=258) throw new InvalidOperationException("wait_failed");
                if(clock.ElapsedMilliseconds>=timeoutMs) { result.status="timeout"; break; }
            }
            // Also terminate descendants after a normal parent exit; the job is still queryable.
            Check(TerminateJobObject(job,1));
            var cleanup=Stopwatch.StartNew();
            Accounting accounting;
            do {
                Check(QueryInformationJobObject(job,1,out accounting,Marshal.SizeOf<Accounting>(),IntPtr.Zero));
                if(accounting.active==0) break;
                Thread.Sleep(10);
            } while(cleanup.ElapsedMilliseconds<cleanupMs);
            result.activeProcesses=accounting.active; result.totalProcesses=accounting.total;
            result.cleanupVerified=accounting.active==0;
            if(!result.cleanupVerified) throw new InvalidOperationException("cleanup_unverified");
            int remaining=Math.Max(1,cleanupMs-(int)cleanup.ElapsedMilliseconds);
            if(!Task.WaitAll(new Task[]{outTask,errTask},remaining)) throw new InvalidOperationException("pipe_cleanup_unverified");
            if(Volatile.Read(ref overflow)!=0) result.status="output_limit";
            if(result.status=="exited") {
                var utf8=new UTF8Encoding(false,true);
                result.stdout=utf8.GetString(outTask.Result); result.stderr=utf8.GetString(errTask.Result);
                if(!writeTask.Wait(Math.Max(1,cleanupMs-(int)cleanup.ElapsedMilliseconds))) throw new InvalidOperationException("stdin_cleanup_unverified");
            }
            finished=true; return result;
        } finally {
            // Assignment failures leave the child suspended and must never fall back to uncontained execution.
            if(!finished && process.process!=IntPtr.Zero) {
                if(assigned) TerminateJobObject(job,1); else TerminateProcess(process.process,1);
                WaitForSingleObject(process.process,(uint)cleanupMs);
            }
            Close(ref ir); Close(ref iw); Close(ref or); Close(ref ow); Close(ref er); Close(ref ew);
            Close(ref process.thread); Close(ref process.process); Close(ref job);
            result.elapsedMs=clock.ElapsedMilliseconds;
        }
    }
}
