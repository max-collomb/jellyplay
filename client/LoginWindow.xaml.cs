using System.Windows;

namespace client
{
  public partial class LoginWindow : Window
  {
    public string Login { get; private set; }
    public string Password { get; private set; }

    public LoginWindow(string login, string password)
    {
      Login = login;
      Password = password;
      InitializeComponent();
      LoginComboBox.Text = login;
      PasswordBox.Password = password;
    }

    private void OkButton_Click(object sender, RoutedEventArgs e)
    {
      Login = LoginComboBox.Text;
      Password = PasswordBox.Password;
      DialogResult = true;
    }
  }
}
