using System;
using System.Net.Sockets;
using System.Threading.Tasks;

namespace client
{
  public class ConnectionManager
  {
    private string _localAddress;
    private string _publicAddress;

    public ConnectionManager(string localAddress, string publicAddress)
    {
      _localAddress = localAddress;
      _publicAddress = publicAddress;
    }

    public async Task<string> GetOptimalServerUrlAsync()
    {
      if (await IsServerReachableAsync(_localAddress))
      {
        return _localAddress;
      }
      return _publicAddress;
    }

    private async Task<bool> IsServerReachableAsync(string url)
    {
      try
      {
        Uri uri = new(url);
        string host = uri.Host;
        int port = uri.Port;

        using TcpClient client = new();
        var connectTask = client.ConnectAsync(host, port);
        var timeoutTask = Task.Delay(1000); // 1 second timeout

        var completedTask = await Task.WhenAny(connectTask, timeoutTask);

        return (completedTask == connectTask && client.Connected);
      }
      catch (Exception ex)
      {
        Console.WriteLine($"Connection test failed: {ex.Message}");
        return false;
      }
    }
  }
}
