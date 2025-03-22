using RestoreWindowPlace;
using System;
using System.Windows;

namespace client
{
    /// <summary>
  /// Interaction logic for App.xaml
  /// </summary>
  public partial class App : Application
  {
    public WindowPlace WindowPlace { get; }

    public App()
    {
      // Set a name of config file
      this.WindowPlace = new WindowPlace("placement.config");
    }

    protected override void OnExit(ExitEventArgs e)
    {
      base.OnExit(e);
      this.WindowPlace.Save();
    }
  }
}
