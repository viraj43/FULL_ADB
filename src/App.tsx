/// <reference types="w3c-web-usb" />
import { useState } from "react";
import { Adb, AdbDaemonAuthenticator } from "@yume-chan/adb";
import { AdbDaemonWebUsbDeviceManager } from "@yume-chan/adb-daemon-webusb";
import { AdbWebCryptoCredentialManager } from "@yume-chan/adb-credential-web";

class InMemoryKeyStorage {
  private keys = new Map<string, Uint8Array>();

  *load() {
    for (const [name, privateKey] of this.keys.entries()) {
      yield { name, privateKey };
    }
  }

  async save(privateKey: Uint8Array, name: string | undefined): Promise<undefined> {
    if (name) {
      this.keys.set(name, privateKey);
    }
    return undefined;
  }
}

function App() {
  const [adb, setAdb] = useState<Adb | null>(null);
  const [status, setStatus] = useState("Not connected");
  const [deviceInfo, setDeviceInfo] = useState<Record<string, string> | null>(null);

  async function connectDevice() {
    try {
      if (!("usb" in navigator)) {
        throw new Error("WebUSB not supported. Use Chrome or Edge.");
      }

      const manager = AdbDaemonWebUsbDeviceManager.BROWSER;

      if (!manager) {
        throw new Error("WebUSB device manager not available in this environment.");
      }

      const device = await manager.requestDevice();
      if (!device) {
        throw new Error("Device is not here.");
      }

      const connection = await device.connect();

      const credentialStore = new AdbWebCryptoCredentialManager(
        new InMemoryKeyStorage()
      );

      // Try with credentialStore property
      const transport = await AdbDaemonAuthenticator.authenticate({
        serial: device.serial,
        connection: connection,
        credentialManager: credentialStore,
      });

      const adbInstance = new Adb(transport);

      setAdb(adbInstance);
      setStatus(`✅ Connected to ${transport.serial}`);

      console.log("ADB Connected:", adbInstance);

      // Fetch basic device info
      const model = await adbInstance.getProp("ro.product.model");
      const manufacturer = await adbInstance.getProp("ro.product.manufacturer");
      const sdk = await adbInstance.getProp("ro.build.version.sdk");
      const release = await adbInstance.getProp("ro.build.version.release");

      const info = {
        "Model": model,
        "Manufacturer": manufacturer,
        "Android Version": release,
        "SDK": sdk,
        "Serial": transport.serial,
      };

      setDeviceInfo(info);
      console.table(info);
    } catch (e) {
      console.error("❌ Connection failed:", e);
      setStatus("❌ Connection failed");
    }
  }

  async function disconnectDevice() {
    if (adb) {
      try {
        await adb.close();
      } catch (e) {
        console.error("Disconnect error:", e);
      }
      setAdb(null);
      setDeviceInfo(null);
      setStatus("Disconnected");
    }
  }

  return (
    <div style={{ textAlign: "center", marginTop: "2rem", padding: "1rem" }}>
      <h2>📱 Android Web ADB Connection</h2>

      <p
        style={{
          fontWeight: "bold",
          margin: "1rem 0",
          color: status.includes("❌") ? "#dc3545" : status.includes("✅") ? "#28a745" : "#333",
        }}
      >
        {status}
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <button
          onClick={connectDevice}
          disabled={!!adb}
          style={{
            padding: "0.5rem 1rem",
            cursor: adb ? "not-allowed" : "pointer",
            opacity: adb ? 0.5 : 1,
          }}
        >
          🔌 Connect Device
        </button>
        <button
          onClick={disconnectDevice}
          disabled={!adb}
          style={{
            padding: "0.5rem 1rem",
            cursor: !adb ? "not-allowed" : "pointer",
            opacity: !adb ? 0.5 : 1,
          }}
        >
          🔌 Disconnect
        </button>
      </div>

      {deviceInfo && (
        <div
          style={{
            margin: "0 auto",
            maxWidth: "400px",
            textAlign: "left",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "1rem",
            backgroundColor: "#fafafa",
          }}
        >
          <h3 style={{ textAlign: "center" }}>📋 Device Info</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {Object.entries(deviceInfo).map(([key, value]) => (
              <li key={key} style={{ marginBottom: "0.5rem" }}>
                <strong>{key}:</strong> {value}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: "1.5rem", fontSize: "0.85rem", color: "#666" }}>
        <p><strong>💡 Tips:</strong></p>
        <ul style={{ textAlign: "left", display: "inline-block", maxWidth: "500px" }}>
          <li>Enable USB Debugging on your Android device</li>
          <li>Use Chrome or Edge for WebUSB support</li>
          <li>Close any other running ADB instances (e.g., Android Studio)</li>
        </ul>
      </div>
    </div>
  );
}

export default App;