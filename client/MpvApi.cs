using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace client
{
  class MpvApi
  {
    public event Action<int> PositionChanged;
    public MpvApi(Action<int> _PositionChanged)
    {
      PositionChanged = _PositionChanged;
    }
    public void PollPlaybackTime()
    {
      var pipeClient = new NamedPipeClientStream(".", "mpvsocket", PipeDirection.InOut);
      pipeClient.Connect();
      var stream = new StreamString(pipeClient);
      int i = 1;
      //stream.WriteString("{ \"command\": [\"observe_property\", 222, \"playback-time\"], \"request_id\": " + i + ", }\r\n");
      while (true)
      {
        try
        {
          stream.WriteString("{ \"command\": [\"get_property_string\", \"playback-time\"], \"request_id\": " + i + ", }\r\n");
        }
        catch (IOException)
        {
          Debug.WriteLine("Broken pipe => stop");
          return;
        }
        Thread.Sleep(500);
        string str = stream.ReadString();
        Match match = Regex.Match(str, $@"\{{""data"":""([0-9\\.]+)"",""request_id"":{i},""error"":""success""\}}");
        // Debug.WriteLine(str + " => match " + (match.Success ? "TRUE" : "FALSE"));
        if (match.Success)
        {
          str = match.Groups[1].Value;
          int position = (int)Math.Floor(float.Parse(str, CultureInfo.InvariantCulture));
          if (position > 0)
          {
            PositionChanged.Invoke(position);
          }
        }
        Thread.Sleep(3000);
        i++;
      }
    }
  }
}
