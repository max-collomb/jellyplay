using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Text;

namespace client
{
  public class StreamString
  {
    private Stream ioStream;
    private UTF8Encoding streamEncoding;

    public StreamString(Stream ioStream)
    {
      this.ioStream = ioStream;
      //ioStream.ReadTimeout = 1000;
      streamEncoding = new UTF8Encoding();
    }

    public string ReadString()
    {
      var inBuffer = new byte[1024];
      ioStream.Read(inBuffer, 0, 1024);
      // Debug.WriteLine("READING : " + streamEncoding.GetString(inBuffer));
      return streamEncoding.GetString(inBuffer);
    }

    public void WriteString(string outString)
    {
      // Debug.WriteLine("WRITING : " + outString);
      ioStream.Write(streamEncoding.GetBytes(outString));
      ioStream.Flush();
    }
  }
}