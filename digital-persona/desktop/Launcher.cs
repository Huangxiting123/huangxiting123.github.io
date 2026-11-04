using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class Program {
 internal static string Home,Runtime,Token,Url; internal static Process Child; internal static volatile bool Cancelled; static Mutex Instance; static bool OwnsInstance; static readonly object LogLock=new object();
 [STAThread] static int Main(string[] args){
  bool test=Array.IndexOf(args,"--self-test")>=0;
  try {Home=Environment.GetEnvironmentVariable("STILLHERE_HOME");if(String.IsNullOrEmpty(Home))Home=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Stillhere");Home=Path.GetFullPath(Home);Directory.CreateDirectory(Home);string instanceName;using(var hash=SHA256.Create())instanceName=BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(Home))).Replace("-","");Instance=new Mutex(false,"Local\\Stillhere_"+instanceName);try{OwnsInstance=Instance.WaitOne(0);}catch(AbandonedMutexException){OwnsInstance=true;}if(!OwnsInstance){if(!test)MessageBox.Show("续在已在运行，请从已有控制台打开界面。","续在");return 0;}
   if(test){try{Prepare();Start();Check();Stop();Start();var state=Api("GET","state",null);if(!state.Contains("EXE_TEST_MEMORY"))throw new Exception("Restart persistence failed");Stop();File.WriteAllText(Path.Combine(Home,"self-test.json"),"{\"ok\":true,\"checks\":[\"embedded_runtime\",\"http_ready\",\"interface_assets\",\"authorization\",\"memory_chat\",\"restart_persistence\",\"process_stop\"]}");return 0;}catch(Exception e){Stop();File.WriteAllText(Path.Combine(Home,"self-test.json"),"{\"ok\":false,\"error\":\""+Escape(e.Message)+"\"}");return 1;}}
   Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new ControlWindow());return 0;
  }catch(Exception e){if(!test)MessageBox.Show(e.Message,"续在启动失败",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;}finally{Stop();if(OwnsInstance&&Instance!=null)Instance.ReleaseMutex();if(Instance!=null)Instance.Dispose();}
 }
 static string Escape(string s){return s.Replace("\\","\\\\").Replace("\"","\\\"").Replace("\r"," ").Replace("\n"," ");}
 internal static void Prepare(){
  byte[] payload;using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))using(var memory=new MemoryStream()){stream.CopyTo(memory);payload=memory.ToArray();}
  string hash;using(var sha=SHA256.Create())hash=BitConverter.ToString(sha.ComputeHash(payload)).Replace("-","").Substring(0,16);
  Runtime=Path.Combine(Home,"runtime",hash);if(!File.Exists(Path.Combine(Runtime,"ready.flag"))){Directory.CreateDirectory(Runtime);using(var memory=new MemoryStream(payload))using(var zip=new ZipArchive(memory,ZipArchiveMode.Read)){foreach(var entry in zip.Entries){var target=Path.GetFullPath(Path.Combine(Runtime,entry.FullName));if(!target.StartsWith(Runtime+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new Exception("Invalid embedded path");Directory.CreateDirectory(Path.GetDirectoryName(target));using(var input=entry.Open())using(var output=File.Create(target))input.CopyTo(output);}}File.WriteAllText(Path.Combine(Runtime,"ready.flag"),"ready");}
  Directory.CreateDirectory(Path.Combine(Home,"data"));var tokenPath=Path.Combine(Home,"owner.token");if(File.Exists(tokenPath))Token=File.ReadAllText(tokenPath).Trim();else {var bytes=new byte[32];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(bytes);Token=BitConverter.ToString(bytes).Replace("-","").ToLowerInvariant();File.WriteAllText(tokenPath,Token);}if(Token.Length!=64)throw new Exception("访问凭证文件异常，请检查数据目录中的 owner.token。");
 }
 internal static void Start(){if(Cancelled)throw new Exception("启动已取消");
  var listener=new TcpListener(IPAddress.Loopback,0);listener.Start();int port=((IPEndPoint)listener.LocalEndpoint).Port;listener.Stop();Url="http://127.0.0.1:"+port+"/";
  var info=new ProcessStartInfo(Path.Combine(Runtime,"node.exe"),"\""+Path.Combine(Runtime,"app","server.mjs")+"\"");info.WorkingDirectory=Path.Combine(Runtime,"app");info.UseShellExecute=false;info.CreateNoWindow=true;info.RedirectStandardOutput=true;info.RedirectStandardError=true;info.EnvironmentVariables["PORT"]=port.ToString();info.EnvironmentVariables["PERSONA_OWNER_TOKEN"]=Token;info.EnvironmentVariables["PERSONA_DATA"]=Path.Combine(Home,"data","persona.json");
  Child=new Process();Child.StartInfo=info;Child.OutputDataReceived+=(s,e)=>Log(e.Data);Child.ErrorDataReceived+=(s,e)=>Log(e.Data);Child.Start();Child.BeginOutputReadLine();Child.BeginErrorReadLine();
  for(int i=0;i<100;i++){if(Cancelled){Stop();throw new Exception("启动已取消");}if(Child.HasExited)throw new Exception("本地服务启动失败，请查看运行日志。");try{var request=(HttpWebRequest)WebRequest.Create(Url);request.Timeout=500;using(var response=(HttpWebResponse)request.GetResponse())if(response.StatusCode==HttpStatusCode.OK)return;}catch{}Thread.Sleep(200);}Stop();throw new Exception("本地服务未能及时就绪，请查看日志。");
 }
 static void Log(string line){if(String.IsNullOrEmpty(line)||line.StartsWith("Owner credential:"))return;lock(LogLock){try{File.AppendAllText(Path.Combine(Home,"runtime.log"),DateTime.Now.ToString("s")+" "+line+Environment.NewLine);}catch{}}}
 internal static void Stop(){var child=Child;Child=null;if(child!=null){try{if(!child.HasExited){child.Kill();child.WaitForExit(5000);}}catch{}child.Dispose();}}
 static string Api(string method,string path,string json){var request=(HttpWebRequest)WebRequest.Create(Url+"api/"+path);request.Method=method;request.Timeout=10000;request.Headers["Authorization"]="Bearer "+Token;if(json!=null){request.ContentType="application/json";var bytes=Encoding.UTF8.GetBytes(json);using(var stream=request.GetRequestStream())stream.Write(bytes,0,bytes.Length);}using(var response=request.GetResponse())using(var reader=new StreamReader(response.GetResponseStream()))return reader.ReadToEnd();}
 static void Check(){foreach(var asset in new[]{"client.js","navigation.js","memory-browser.js","voice-client.js","message-details.js"}){var request=(HttpWebRequest)WebRequest.Create(Url+asset);request.Timeout=10000;using(var response=request.GetResponse())using(var reader=new StreamReader(response.GetResponseStream()))if(reader.ReadToEnd().Length<100)throw new Exception("Missing interface asset: "+asset);}var state=Api("GET","state",null);if(!state.Contains("profile"))throw new Exception("API authorization failed");Api("POST","profile","{\"name\":\"EXE_TEST\"}");Api("POST","memories","{\"text\":\"EXE_TEST_MEMORY\"}");var chat=Api("POST","chat","{\"text\":\"EXE_TEST_MEMORY\"}");if(!chat.Contains("EXE_TEST_MEMORY"))throw new Exception("Memory chat failed");}
 internal static void OpenInterface(){
  foreach(var candidate in new[]{Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Microsoft","Edge","Application","msedge.exe"),Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Google","Chrome","Application","chrome.exe")}){if(File.Exists(candidate)){Process.Start(new ProcessStartInfo(candidate,"--app=\""+Url+"\" --new-window"){UseShellExecute=true});return;}}
  Process.Start(new ProcessStartInfo(Url){UseShellExecute=true});
 }
}
internal sealed class ControlWindow:Form {
 Label status;TextBox credential;Button open,copy,stop;bool ready,closeRequested;
 public ControlWindow(){Text="续在 STILLHERE · 开发体验版";Size=new Size(570,390);MinimumSize=Size;MaximumSize=Size;StartPosition=FormStartPosition.CenterScreen;BackColor=Color.FromArgb(245,244,237);Font=new Font("Microsoft YaHei UI",10F);FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;
  var title=new Label{Text="续在  STILLHERE",Font=new Font("Microsoft YaHei UI",21F),Location=new Point(28,24),AutoSize=true};Controls.Add(title);status=new Label{Text="正在准备内置运行环境…",Location=new Point(30,81),Size=new Size(490,50)};Controls.Add(status);
  Controls.Add(new Label{Text="所有者访问凭证（首次登录复制到界面）",Location=new Point(30,137),AutoSize=true});credential=new TextBox{Location=new Point(30,166),Size=new Size(405,30),ReadOnly=true,UseSystemPasswordChar=true};Controls.Add(credential);copy=MakeButton("复制",440,164,80,delegate{Clipboard.SetText(Program.Token);status.Text="访问凭证已复制，请在续在登录页粘贴。";});copy.Enabled=false;
  open=MakeButton("打开续在界面",30,216,155,delegate{Program.OpenInterface();});open.Enabled=false;MakeButton("打开数据目录",195,216,155,delegate{Process.Start(new ProcessStartInfo("explorer.exe","\""+Program.Home+"\""){UseShellExecute=true});});stop=MakeButton("停止并退出",360,216,160,delegate{Close();});
  Controls.Add(new Label{Text="本地运行 · 数据独立保存\n此版需配置模型服务；音色复刻与视频通话尚未接入。",Location=new Point(30,272),Size=new Size(490,60),ForeColor=Color.FromArgb(110,125,105)});
  Shown+=async delegate{try{await Task.Run(delegate{Program.Prepare();Program.Start();});if(IsDisposed)return;ready=true;if(closeRequested){Close();return;}credential.Text=Program.Token;open.Enabled=true;copy.Enabled=true;status.Text="服务已就绪。关闭控制台将停止服务，数据会保留。";Program.OpenInterface();}catch(Exception e){ready=true;if(!IsDisposed){status.Text=e.Message;if(closeRequested)Close();}}};
  FormClosing+=delegate(object sender,FormClosingEventArgs e){if(!ready){e.Cancel=true;closeRequested=true;Program.Cancelled=true;status.Text="正在取消启动…";return;}Program.Stop();};
 }
 Button MakeButton(string text,int x,int y,int width,Action action){var b=new Button{Text=text,Location=new Point(x,y),Size=new Size(width,36),FlatStyle=FlatStyle.Flat,BackColor=Color.FromArgb(53,88,71),ForeColor=Color.White};b.Click+=delegate{try{action();}catch(Exception e){status.Text=e.Message;}};Controls.Add(b);return b;}
}
