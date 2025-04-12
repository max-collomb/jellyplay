using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace client
{
  public static class SecureStorage
  {
    private static readonly string filePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "client_credentials");

    public static void SaveCredentials(string login, string password)
    {
      var data = $"{login}:{password}";
      var encryptedData = ProtectedData.Protect(Encoding.UTF8.GetBytes(data), null, DataProtectionScope.CurrentUser);
      File.WriteAllBytes(filePath, encryptedData);
    }

    public static (string login, string password)? LoadCredentials()
    {
      if (!File.Exists(filePath))
        return null;

      var encryptedData = File.ReadAllBytes(filePath);
      var decryptedData = ProtectedData.Unprotect(encryptedData, null, DataProtectionScope.CurrentUser);
      var data = Encoding.UTF8.GetString(decryptedData).Split(':');
      return (data[0], data[1]);
    }
  }
}
