using Microsoft.Web.WebView2.Core;
using System;
using System.Diagnostics;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web;
using System.Windows;
using System.Net.NetworkInformation;

namespace client
{
  /// <summary>
  /// Interaction logic for MainWindow.xaml
  /// </summary>
  public partial class MainWindow : Window
  {
    bool initialized = false;
    // string defaultNasIp = "192.168.0.99";
    // string nasIp = "192.168.0.99";
    public MainWindow()
    {
      InitializeComponent();
      ((App)Application.Current).WindowPlace.Register(this);
      // foreach (NetworkInterface adapter in NetworkInterface.GetAllNetworkInterfaces())
      //   foreach (UnicastIPAddressInformation addr in adapter.GetIPProperties().UnicastAddresses)
      //     if (addr.Address.ToString().StartsWith("10.244"))
      //       nasIp = "10.244.0.99";
#if DEBUG
      // webView.Source = new Uri("http://127.0.0.1:3000/frontend/");
#else
      // webView.Source = new Uri($"http://{nasIp}:3000/frontend/");
#endif
      // window.Title = $"Jellyplay - {nasIp}";
      webView.Source = new Uri("http://nas.colors.ovh:3000/frontend/");
      window.Title = "Jellyplay - http://nas.colors.ovh:3000/frontend/";
      webView.DefaultBackgroundColor = System.Drawing.Color.Black;
      webView.Visibility = Visibility.Collapsed;
      webView.NavigationStarting += MpvScheme;
      webView.NavigationCompleted += Init;
    }

    async void MpvScheme(object? sender, CoreWebView2NavigationStartingEventArgs args)
    {
      if (args.Uri.StartsWith("http"))
        window.Title = "Jellyplay - " + args.Uri;
      Match match = Regex.Match(args.Uri, @"mpv:\/\/(.*)\?pos=([0-9]*)");
      if (match.Success)
      {
        args.Cancel = true;
        string path = HttpUtility.UrlDecode(match.Groups[1].Value);
        // if (path.Contains("192.168.0.99"))
        //   path = path.Replace("192.168.0.99", "nas.colors.ovh");
        int position = int.Parse(match.Groups[2].Value);
        Debug.WriteLine("path = " + path);
        Debug.WriteLine("position = " + position);
        // Prepare the process to run
        ProcessStartInfo start = new ProcessStartInfo();
        // Enter in the command line arguments, everything you would enter after the executable name itself
        start.Arguments = $"\"{path}\" --start={position} --input-ipc-server=\\\\.\\pipe\\mpvsocket";
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
        Process.Start("explorer", url);
      }
    }

    void Init(object? sender, CoreWebView2NavigationCompletedEventArgs args)
    {
      if (!initialized)
      {
        initialized = true;
        webView.Visibility = Visibility.Visible;
        //webView.CoreWebView2.OpenDevToolsWindow();
      }
      webView.CoreWebView2.ExecuteScriptAsync($"window._mpvSchemeSupported = true;");
    }
  }
}
