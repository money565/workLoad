"""SSH 隧道: localhost:8088 → 远程 uWSGI:8080
运行方式: python3 scripts/tunnel.py
"""
import paramiko
import socket
import select
import sys
import threading

HOST, PORT, USER, PWD = "tanghui.iego.vip", 46070, "xcserver", "1"
LOCAL = ("127.0.0.1", 8088)
REMOTE = ("127.0.0.1", 8080)

def handler(chan, sock):
    for c in (chan, sock):
        c.setblocking(False)
    try:
        while True:
            r, _, _ = select.select([chan, sock], [], [], 30)
            if chan in r:
                d = chan.recv(8192)
                if not d: break
                sock.send(d)
            if sock in r:
                d = sock.recv(8192)
                if not d: break
                chan.send(d)
    except Exception:
        pass
    finally:
        chan.close(); sock.close()

def main():
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(hostname=HOST, port=PORT, username=USER, password=PWD, timeout=10, allow_agent=False, look_for_keys=False)

        server = socket.socket()
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind(LOCAL)
        server.listen(5)

        print(f"✅ 隧道就绪: localhost:{LOCAL[1]} → 远程{REMOTE[0]}:{REMOTE[1]}")
        print("   保持此窗口运行，按 Ctrl+C 断开")

        while True:
            sock, addr = server.accept()
            chan = client.get_transport().open_channel("direct-tcpip", REMOTE, addr)
            if chan is None:
                sock.close(); continue
            threading.Thread(target=handler, args=(chan, sock), daemon=True).start()
    except Exception as e:
        print(f"❌ 隧道失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
