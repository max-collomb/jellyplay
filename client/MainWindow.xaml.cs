using Microsoft.Web.WebView2.Core;
using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
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

    public MainWindow()
    {
      InitializeComponent();
      InitializeWebView2();
      ((App)Application.Current).WindowPlace.Register(this);
    }

    async void InitializeWebView2()
    {
      window.Title = "Jellyplay - http://nas.colors.ovh:3000/frontend/";
      webView.DefaultBackgroundColor = System.Drawing.Color.Black;
      webView.Visibility = Visibility.Collapsed;
      webView.NavigationStarting += NavigationStarting;
      webView.NavigationCompleted += NavigationCompleted;
#if DEBUG
      webView.Source = new Uri("http://127.0.0.1:3000/frontend/");
#else
      webView.Source = new Uri("http://nas.colors.ovh:3000/frontend/");
#endif
      await webView.EnsureCoreWebView2Async();
      webView.CoreWebView2.FrameCreated += FrameCreated;
      webView.CoreWebView2.FrameNavigationStarting += FrameNavigationStarting;
      webView.CoreWebView2.FrameNavigationCompleted += FrameNavigationCompleted;
      webView.CoreWebView2.DownloadStarting += DownloadStarting;
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
      Match match = Regex.Match(args.Uri, @"mpv:\/\/(.*)\?pos=([0-9]*)");
      if (match.Success)
      {
        args.Cancel = true;
        string path = HttpUtility.UrlDecode(match.Groups[1].Value);
        int position = (match.Groups[2].Value.Length > 0) ? int.Parse(match.Groups[2].Value) : -1;
        Debug.WriteLine("path = " + path);
        Debug.WriteLine("position = " + position);
        // Prepare the process to run
        ProcessStartInfo start = new ProcessStartInfo();
        // Enter in the command line arguments, everything you would enter after the executable name itself
        string startPosArg = position > -1 ? $"--start={position} " : "";
        start.Arguments = $"\"{path}\" {startPosArg}--input-ipc-server=\\\\.\\pipe\\mpvsocket";
        string exeFilePath = System.Reflection.Assembly.GetExecutingAssembly().Location;
        string? workPath = System.IO.Path.GetDirectoryName(exeFilePath);
        start.FileName = System.IO.Path.Combine(workPath??"", "mpv", "mpv.exe");
        Debug.WriteLine(start.FileName);
        Debug.WriteLine(start.Arguments);
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
      webView.CoreWebView2.ExecuteScriptAsync($"window._mpvSchemeSupported = true;");
    }
  }
}
