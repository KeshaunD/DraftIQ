using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

internal static class DraftIQYahooHost
{
    private const int OBinary = 0x8000;
    private const int MaximumMessageLength = 1024 * 1024;
    private static Process helperProcess;

    [DllImport("msvcrt.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int _setmode(int fileDescriptor, int mode);

    private static int Main()
    {
        TryEnableBinaryMode();

        Stream input = Console.OpenStandardInput();
        Stream output = Console.OpenStandardOutput();

        try
        {
            while (true)
            {
                string message = ReadMessage(input);
                if (message == null)
                {
                    break;
                }

                string requestId = ExtractJsonString(message, "requestId");
                string action = ExtractJsonString(message, "action");

                if (String.Equals(action, "stop", StringComparison.OrdinalIgnoreCase))
                {
                    StopOwnedHelper();
                    WriteMessage(output, BuildResponse(true, false, requestId, null));
                    continue;
                }

                string error;
                bool running = EnsureHelperRunning(out error);
                WriteMessage(output, BuildResponse(running, running, requestId, error));
            }

            return 0;
        }
        catch (Exception error)
        {
            try
            {
                WriteMessage(output, BuildResponse(false, false, String.Empty, error.Message));
            }
            catch
            {
                // Chrome closed the native messaging pipe.
            }

            return 1;
        }
        finally
        {
            StopOwnedHelper();
        }
    }

    private static bool EnsureHelperRunning(out string error)
    {
        error = null;

        if (IsHelperListening())
        {
            return true;
        }

        try
        {
            string nativeHostRoot = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(
                Path.DirectorySeparatorChar,
                Path.AltDirectorySeparatorChar
            );
            DirectoryInfo helperRootInfo = Directory.GetParent(nativeHostRoot);

            if (helperRootInfo == null)
            {
                throw new InvalidOperationException("The Yahoo helper folder could not be found.");
            }

            string helperRoot = helperRootInfo.FullName;
            string serverPath = Path.Combine(helperRoot, "server.js");

            if (!File.Exists(serverPath))
            {
                throw new FileNotFoundException("DraftIQ Yahoo server.js was not found.", serverPath);
            }

            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = ResolveNodePath(nativeHostRoot);
            startInfo.Arguments = "\"" + serverPath + "\"";
            startInfo.WorkingDirectory = helperRoot;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            startInfo.WindowStyle = ProcessWindowStyle.Hidden;
            startInfo.RedirectStandardOutput = true;
            startInfo.RedirectStandardError = true;

            helperProcess = new Process();
            helperProcess.StartInfo = startInfo;
            helperProcess.OutputDataReceived += IgnoreProcessOutput;
            helperProcess.ErrorDataReceived += IgnoreProcessOutput;

            if (!helperProcess.Start())
            {
                throw new InvalidOperationException("Node.js could not start the Yahoo helper.");
            }

            helperProcess.BeginOutputReadLine();
            helperProcess.BeginErrorReadLine();

            for (int attempt = 0; attempt < 80; attempt += 1)
            {
                if (IsHelperListening())
                {
                    return true;
                }

                if (helperProcess.HasExited)
                {
                    throw new InvalidOperationException(
                        "The Yahoo helper stopped during startup (exit " + helperProcess.ExitCode + ")."
                    );
                }

                Thread.Sleep(100);
            }

            throw new TimeoutException("The Yahoo helper did not open its local connection in time.");
        }
        catch (Exception exception)
        {
            error = exception.Message;
            StopOwnedHelper();
            return false;
        }
    }

    private static string ResolveNodePath(string nativeHostRoot)
    {
        string configuredPathFile = Path.Combine(nativeHostRoot, "node-path.txt");

        if (File.Exists(configuredPathFile))
        {
            string configuredPath = File.ReadAllText(configuredPathFile).Trim();
            if (File.Exists(configuredPath))
            {
                return configuredPath;
            }
        }

        string pathValue = Environment.GetEnvironmentVariable("PATH") ?? String.Empty;
        foreach (string folder in pathValue.Split(Path.PathSeparator))
        {
            string cleanFolder = folder.Trim().Trim('"');
            if (cleanFolder.Length == 0)
            {
                continue;
            }

            string candidate = Path.Combine(cleanFolder, "node.exe");
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        string documentsCandidate = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
            "Node.js",
            "node.exe"
        );

        if (File.Exists(documentsCandidate))
        {
            return documentsCandidate;
        }

        return "node.exe";
    }

    private static bool IsHelperListening()
    {
        try
        {
            using (TcpClient client = new TcpClient())
            {
                client.ReceiveTimeout = 250;
                client.SendTimeout = 250;
                client.Connect("127.0.0.1", 3210);
                return client.Connected;
            }
        }
        catch
        {
            return false;
        }
    }

    private static void StopOwnedHelper()
    {
        Process process = helperProcess;
        helperProcess = null;

        if (process == null)
        {
            return;
        }

        try
        {
            if (!process.HasExited)
            {
                process.Kill();
                process.WaitForExit(2000);
            }
        }
        catch
        {
            // The child is already gone or Chrome is shutting down.
        }
        finally
        {
            process.Dispose();
        }
    }

    private static void IgnoreProcessOutput(object sender, DataReceivedEventArgs args)
    {
        // Never write child output to stdout; stdout is reserved for Chrome messages.
    }

    private static string ReadMessage(Stream input)
    {
        byte[] lengthBytes = ReadExact(input, 4, true);
        if (lengthBytes == null)
        {
            return null;
        }

        int length = lengthBytes[0]
            | (lengthBytes[1] << 8)
            | (lengthBytes[2] << 16)
            | (lengthBytes[3] << 24);

        if (length < 0 || length > MaximumMessageLength)
        {
            throw new InvalidDataException("Chrome sent an invalid native message length.");
        }

        byte[] payload = ReadExact(input, length, false);
        return Encoding.UTF8.GetString(payload);
    }

    private static byte[] ReadExact(Stream input, int count, bool allowEndOfStream)
    {
        byte[] buffer = new byte[count];
        int offset = 0;

        while (offset < count)
        {
            int read = input.Read(buffer, offset, count - offset);
            if (read == 0)
            {
                if (allowEndOfStream && offset == 0)
                {
                    return null;
                }

                throw new EndOfStreamException("Chrome closed an incomplete native message.");
            }

            offset += read;
        }

        return buffer;
    }

    private static void WriteMessage(Stream output, string json)
    {
        byte[] payload = Encoding.UTF8.GetBytes(json);
        byte[] length = new byte[]
        {
            (byte)(payload.Length & 0xff),
            (byte)((payload.Length >> 8) & 0xff),
            (byte)((payload.Length >> 16) & 0xff),
            (byte)((payload.Length >> 24) & 0xff)
        };

        output.Write(length, 0, length.Length);
        output.Write(payload, 0, payload.Length);
        output.Flush();
    }

    private static string ExtractJsonString(string json, string propertyName)
    {
        Match match = Regex.Match(
            json ?? String.Empty,
            "\\\"" + Regex.Escape(propertyName) + "\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"",
            RegexOptions.CultureInvariant
        );

        return match.Success ? match.Groups[1].Value : String.Empty;
    }

    private static string BuildResponse(
        bool ok,
        bool running,
        string requestId,
        string error
    )
    {
        StringBuilder json = new StringBuilder();
        json.Append("{\"ok\":").Append(ok ? "true" : "false");
        json.Append(",\"running\":").Append(running ? "true" : "false");
        json.Append(",\"requestId\":\"").Append(EscapeJson(requestId)).Append("\"");

        if (!String.IsNullOrEmpty(error))
        {
            json.Append(",\"error\":\"").Append(EscapeJson(error)).Append("\"");
        }

        json.Append("}");
        return json.ToString();
    }

    private static string EscapeJson(string value)
    {
        return (value ?? String.Empty)
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", "\\r")
            .Replace("\n", "\\n");
    }

    private static void TryEnableBinaryMode()
    {
        try
        {
            _setmode(0, OBinary);
            _setmode(1, OBinary);
        }
        catch
        {
            // Standard streams are still usable when binary mode is already active.
        }
    }
}
