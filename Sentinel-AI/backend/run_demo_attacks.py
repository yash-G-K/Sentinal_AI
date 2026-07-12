import subprocess
import time
import sys

print("======================================================")
print(" Sentinel-AI WAF - Dual Domain Attack Simulator")
print("======================================================")
print("[*] Starting attack simulation for: dvwa.local")
print("[*] Starting attack simulation for: juice-shop.local")
print("[*] Using global IPs and diverse countries...")
print("======================================================")
print("Press Ctrl+C to stop both simulations at any time.\n")

# Start both processes in parallel
proc1 = subprocess.Popen([sys.executable, "simulate_global_attacks.py", "--domain", "dvwa.local"])
proc2 = subprocess.Popen([sys.executable, "simulate_global_attacks.py", "--domain", "juice-shop.local"])

try:
    # Keep the main script alive while subprocesses run
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\n[!] Stopping both simulations...")
    proc1.terminate()
    proc2.terminate()
    proc1.wait()
    proc2.wait()
    print("[*] Simulations stopped successfully.")
