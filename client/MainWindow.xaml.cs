using Microsoft.Web.WebView2.Core;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;

namespace client
{
  /// <summary>
  /// Interaction logic for MainWindow.xaml
  /// </summary>
  public partial class MainWindow : Window
  {
    bool initialized = false;
    public MainWindow()
    {
      InitializeComponent();
      ((App)Application.Current).WindowPlace.Register(this);
      webView.DefaultBackgroundColor = System.Drawing.Color.Black;
      webView.Visibility = Visibility.Collapsed;
      webView.NavigationStarting += MpvScheme;
      webView.NavigationCompleted += Init;
    }

    async void MpvScheme(object? sender, CoreWebView2NavigationStartingEventArgs args)
    {

      Match match = Regex.Match(args.Uri, @"mpv:\/\/(.*)\?pos=([0-9]*)");
      if (match.Success)
      {
        args.Cancel = true;
        string path = HttpUtility.UrlDecode(match.Groups[1].Value);
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
