using Microsoft.Web.WebView2.Core;
using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web;
using System.Windows;

namespace client
{
  /// <summary>
  /// Interaction logic for MainWindow.xaml
  /// </summary>
  public partial class MainWindow : Window
  {
    private bool initialized = false;
    private CoreWebView2Frame? iFrame;
    private string uploadUrl = "";
    private string basicLogin = "";
    private string basicPassword = "";
    private int count401 = 0;

    public MainWindow()
    {
      InitializeComponent();
      InitializeWebView2();
      ((App)Application.Current).WindowPlace.Register(this);
      var credentials = SecureStorage.LoadCredentials();
      if (credentials == null)
      {
        var loginWindow = new LoginWindow(string.Empty, string.Empty, null);
        if (loginWindow.ShowDialog() == true)
        {
          count401 = 0;
          SecureStorage.SaveCredentials(loginWindow.Login, loginWindow.Password);
          basicLogin = loginWindow.Login;
          basicPassword = loginWindow.Password;
        }
        else
        {
          Application.Current.Shutdown();
        }
      }
      else
      {
        basicLogin = credentials.Value.login;
        basicPassword = credentials.Value.password;
      }
    }

    async void InitializeWebView2()
    {
      window.Title = "Jellyplay - loading...";
      webView.DefaultBackgroundColor = System.Drawing.Color.Black;
      webView.Visibility = Visibility.Collapsed;
      webView.NavigationStarting += NavigationStarting;
      webView.NavigationCompleted += NavigationCompleted;
#if DEBUG
      webView.Source = new Uri("http://127.0.0.1:3000/frontend/");
#else
      var connectionManager = new ConnectionManager(
        localAddress: "http://192.168.0.99:3000/frontend/",
        publicAddress: "https://jellyplay.synology.me:37230/frontend/"
      );
      string serverAddress = await connectionManager.GetOptimalServerUrlAsync();
      Debug.WriteLine($"Connecting to {serverAddress}");
      webView.Source = new Uri(serverAddress);
#endif
      await webView.EnsureCoreWebView2Async();
      webView.CoreWebView2.BasicAuthenticationRequested += CoreWebView2_BasicAuthenticationRequested;
      webView.CoreWebView2.FrameCreated += FrameCreated;
      webView.CoreWebView2.FrameNavigationStarting += FrameNavigationStarting;
      webView.CoreWebView2.FrameNavigationCompleted += FrameNavigationCompleted;
      webView.CoreWebView2.DownloadStarting += DownloadStarting;
    }

    private void CoreWebView2_BasicAuthenticationRequested(object? sender, CoreWebView2BasicAuthenticationRequestedEventArgs e)
    {
      e.Response.UserName = basicLogin;
      e.Response.Password = basicPassword;
    }

    private void FrameCreated(object? sender, CoreWebView2FrameCreatedEventArgs args)
    {
      Debug.WriteLine("FrameNavigationCreated");
      iFrame = args.Frame;
    }

    private void FrameNavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs args)
    {
      Debug.WriteLine("FrameNavigationStarting : " + args.Uri);
      args.AdditionalAllowedFrameAncestors = "*";
    }

    private async void FrameNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs args)
    {
      if (iFrame != null)
      {
        try
        {
          string onloaded = await webView.CoreWebView2.ExecuteScriptAsync($"document.querySelector('iframe').dataset.onloaded");
          uploadUrl = (await webView.CoreWebView2.ExecuteScriptAsync($"new URL(document.querySelector('iframe').dataset.uploadurl, document.baseURI).href")).Replace("\"", "");
          await iFrame.ExecuteScriptAsync("eval(" + onloaded + ")");
        }
        catch (Exception) {}
      }
    }

    private void DownloadStarting(object? sender, CoreWebView2DownloadStartingEventArgs args)
    {
      args.Handled = true;
      args.DownloadOperation.StateChanged += async (o, e) => 
      {
        if (args.DownloadOperation.State == CoreWebView2DownloadState.Completed
          && args.DownloadOperation.ResultFilePath.ToLower().EndsWith(".torrent")
          && !string.IsNullOrEmpty(uploadUrl))
        {
          Debug.WriteLine("Download completed " + args.DownloadOperation.ResultFilePath);
          using var httpClient = new HttpClient();
          using var formContent = new MultipartFormDataContent();
          var fileBytes = File.ReadAllBytes(args.DownloadOperation.ResultFilePath);
          var fileContent = new ByteArrayContent(fileBytes);
          File.Delete(args.DownloadOperation.ResultFilePath);
          fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/x-bittorrent");
          formContent.Add(fileContent, "file", Path.GetFileName(args.DownloadOperation.ResultFilePath));
          var response = await httpClient.PostAsync(uploadUrl, formContent);
          Debug.WriteLine(response.IsSuccessStatusCode ? "File uploaded successfully!" : $"Upload failed with status code: {response.StatusCode}");
        }
      };
    }

    async void NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs args)
    {
      if (args.Uri.StartsWith("http"))
        window.Title = "Jellyplay - " + args.Uri;
      Match match = Regex.Match(args.Uri, @"mpv([s]{0,1}):\/\/(.*)\?pos=([0-9]*)");
      if (match.Success)
      {
        args.Cancel = true;
        string url = "http" + match.Groups[1].Value + "://" + match.Groups[2].Value;
        int position = (match.Groups[3].Value.Length > 0) ? int.Parse(match.Groups[3].Value) : -1;
        Debug.WriteLine("url = " + url);
        Debug.WriteLine("position = " + position);
        // Prepare the process to run
        ProcessStartInfo start = new ProcessStartInfo();
        // Enter in the command line arguments, everything you would enter after the executable name itself
        string startPosArg = position > -1 ? $"--start={position} " : "";
        string headers = $"--http-header-fields=\"Authorization: Basic {Convert.ToBase64String(Encoding.UTF8.GetBytes(basicLogin + ":" + basicPassword))}\" ";
        start.Arguments = $"\"{url}\" {headers}{startPosArg}--input-ipc-server=\\\\.\\pipe\\mpvsocket";
        string exeFilePath = System.Reflection.Assembly.GetExecutingAssembly().Location;
        string? workPath = Path.GetDirectoryName(exeFilePath);
        start.FileName = Path.Combine(workPath??"", "mpv", "mpv.exe");
        Debug.WriteLine(start.FileName + " " + start.Arguments);
        // Do you want to show a console window?
        start.WindowStyle = ProcessWindowStyle.Hidden;
        start.CreateNoWindow = true;


        // Run the external process & wait for it to finish
        using Process? proc = Process.Start(start);
        {
          MpvApi mpvApi = new MpvApi((position) =>
          {
            Dispatcher.BeginInvoke((Action)delegate ()
            {
              webView.CoreWebView2.ExecuteScriptAsync($"window._setPosition({position});");
            });
          });
          Thread t = new Thread(mpvApi.PollPlaybackTime);
          t.Start();
          if (proc != null)
          {
            await proc.WaitForExitAsync();
            await webView.CoreWebView2.ExecuteScriptAsync($"window._exited(); console.log(\"exited with code {proc.ExitCode}\");");
          }
        }
      }

      match = Regex.Match(args.Uri, @"browser:\/\/(.*)");
      if (match.Success)
      {
        args.Cancel = true;
        string url = HttpUtility.UrlDecode(match.Groups[1].Value);
        Debug.WriteLine("url= " + url);
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
      }

      match = Regex.Match(args.Uri, @"jellyplay:\/\/(.*)");
      if (match.Success)
      {
        args.Cancel = true;
        string action = HttpUtility.UrlDecode(match.Groups[1].Value);
        Debug.WriteLine("action= " + action);
        if (action == "logform")
        {
          var credentials = SecureStorage.LoadCredentials();
          var login = credentials != null ? credentials.Value.login : string.Empty;
          var password = credentials != null ? credentials.Value.password : string.Empty;
          var loginWindow = new LoginWindow(login, password, this);
          if (loginWindow.ShowDialog() == true)
          {
            count401 = 0;
            SecureStorage.SaveCredentials(loginWindow.Login, loginWindow.Password);
            if (loginWindow.Login != login || loginWindow.Password != password)
            {
              string executablePath = Process.GetCurrentProcess().MainModule?.FileName ?? string.Empty; // Get the path of the current executable
              if (!string.IsNullOrEmpty(executablePath))
              {
                Process.Start(executablePath); // Start a new instance of the application
                Application.Current.Shutdown(); // Shut down the current instance
              }
            }
          }
        }
      }

    }

    void NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs args)
    {
      if (!initialized)
      {
        initialized = true;
        webView.Visibility = Visibility.Visible;
#if DEBUG
        webView.CoreWebView2.OpenDevToolsWindow();
#endif
      }

      // Check if the navigation resulted in a 401 Unauthorized error
      if (args.HttpStatusCode == 401)
      {
        // It seems that there's a least one 401 error, even if the credentials are ok
        count401++;
        if (count401 > 2)
        {
          Debug.WriteLine("401 Unauthorized detected. Opening login window...");

          // Open the login window
          var credentials = SecureStorage.LoadCredentials();
          var login = credentials != null ? credentials.Value.login : string.Empty;
          var password = credentials != null ? credentials.Value.password : string.Empty;
          var loginWindow = new LoginWindow(login, password, this);

          if (loginWindow.ShowDialog() == true)
          {
            count401 = 0;
            // Save the new credentials
            SecureStorage.SaveCredentials(loginWindow.Login, loginWindow.Password);
            basicLogin = loginWindow.Login;
            basicPassword = loginWindow.Password;

            // Reload the page with the new credentials
            webView.CoreWebView2.Reload();
          }
          else
          {
            // If the user cancels the login, shut down the application
            Application.Current.Shutdown();
          }
        }
      }
      else
      {
        webView.CoreWebView2.ExecuteScriptAsync($"window._mpvSchemeSupported = true;");
      }
    }
  }
}
