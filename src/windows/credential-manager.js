'use strict';
/**
 * Windows Credential Manager, read through PowerShell calling CredReadW for Generic credentials.
 * Blobs come back as base64 of their raw bytes and are decoded by the caller. Neither a blob nor PowerShell's stderr
 * is logged: stderr can echo credential data.
 */
const { execFile } = require('node:child_process');
const { createModuleLog } = require('../shared/log.js');

const log = createModuleLog('credential-manager');
const POWERSHELL_TIMEOUT_MS = 30_000;

const CREDENTIAL_READER_SOURCE = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class AgentUsageCredentialReader {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct Credential {
        public int Flags;
        public int Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }
    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredRead(string target, int type, int flags, out IntPtr credential);
    [DllImport("advapi32.dll")]
    private static extern void CredFree(IntPtr buffer);
    public static string ReadBase64(string target) {
        IntPtr pointer;
        if (!CredRead(target, 1, 0, out pointer)) {
            int code = Marshal.GetLastWin32Error();
            if (code == 1168) { return null; }
            throw new System.ComponentModel.Win32Exception(code);
        }
        try {
            Credential credential = (Credential)Marshal.PtrToStructure(pointer, typeof(Credential));
            byte[] blob = new byte[credential.CredentialBlobSize];
            if (credential.CredentialBlobSize > 0) { Marshal.Copy(credential.CredentialBlob, blob, 0, credential.CredentialBlobSize); }
            return Convert.ToBase64String(blob);
        } finally {
            CredFree(pointer);
        }
    }
}
'@
$rows = @()
foreach ($target in $targets) {
    $blob = [AgentUsageCredentialReader]::ReadBase64($target)
    if ($null -ne $blob) { $rows += [pscustomobject]@{ target = $target; blob = $blob } }
}
ConvertTo-Json -InputObject @($rows) -Compress
`;

function powerShellLiteral(text) {
    return `'${String(text).replace(/'/g, "''")}'`;
}

/**
 * Reads Generic credentials by target name in one PowerShell run.
 * @param {string[]} targetNames
 * @returns {Promise<{ state: 'read', blobs: Map<string, Buffer | null> } | { state: 'failed' }>}
 *   `blobs` maps every requested target to its bytes, or to null when no such credential exists.
 */
function readGenericCredentials(targetNames) {
    const script = `$targets = @(${targetNames.map(powerShellLiteral).join(', ')})\n${CREDENTIAL_READER_SOURCE}`;
    const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
    return new Promise((resolve) => {
        execFile(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedScript],
            { timeout: POWERSHELL_TIMEOUT_MS, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, windowsHide: true },
            (error, stdout) => {
                if (error) {
                    log.warn(
                        `PowerShell credential read failed (exit code ${error.code}, signal ${error.signal ?? 'none'}; ` +
                            'stderr withheld because it can echo credential data)',
                    );
                    resolve({ state: 'failed' });
                    return;
                }
                let rows;
                try {
                    rows = JSON.parse(stdout.trim() || '[]');
                } catch (parseError) {
                    log.warn(`PowerShell credential read printed no JSON (${parseError.name})`);
                    resolve({ state: 'failed' });
                    return;
                }
                const blobs = new Map(targetNames.map((target) => [target, null]));
                for (const row of Array.isArray(rows) ? rows : [rows]) {
                    if (row && typeof row.target === 'string' && typeof row.blob === 'string') {
                        blobs.set(row.target, Buffer.from(row.blob, 'base64'));
                    }
                }
                resolve({ state: 'read', blobs });
            },
        );
    });
}

module.exports = { readGenericCredentials };
