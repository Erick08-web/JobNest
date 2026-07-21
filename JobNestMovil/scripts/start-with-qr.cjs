const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const qrcode = require('qrcode-terminal');

const DEFAULT_PORT = '8081';

function pickLanIp() {
  const interfaces = os.networkInterfaces();
  const preferred = ['en0', 'en1'];

  for (const name of preferred) {
    const match = findIpv4(interfaces[name]);
    if (match) {
      return match.address;
    }
  }

  for (const entries of Object.values(interfaces)) {
    const match = findIpv4(entries);
    if (match) {
      return match.address;
    }
  }

  return '127.0.0.1';
}

function findIpv4(entries = []) {
  return entries.find((entry) => entry.family === 'IPv4' && !entry.internal);
}

function getOptionValue(args, optionName) {
  const inline = args.find((arg) => arg.startsWith(`${optionName}=`));
  if (inline) {
    return inline.slice(optionName.length + 1);
  }

  const index = args.indexOf(optionName);
  if (index >= 0) {
    return args[index + 1];
  }

  return undefined;
}

function hasOption(args, optionName) {
  return args.some((arg) => arg === optionName || arg.startsWith(`${optionName}=`));
}

const extraArgs = process.argv.slice(2);
const host = process.env.EXPO_LAN_IP || process.env.REACT_NATIVE_PACKAGER_HOSTNAME || pickLanIp();
const port = process.env.EXPO_PORT || getOptionValue(extraArgs, '--port') || DEFAULT_PORT;
const expoUrl = `exp://${host}:${port}`;
const expoBin = path.join(
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'expo.cmd' : 'expo',
);

console.log('');
console.log(`Expo Go QR: ${expoUrl}`);
qrcode.generate(expoUrl, { small: true });
console.log('');
console.log('Starting Expo Metro...');
console.log('');

const args = ['start', '--lan'];

if (!hasOption(extraArgs, '--port')) {
  args.push('--port', port);
}

args.push(...extraArgs);

const child = spawn(expoBin, args, {
  stdio: 'inherit',
  env: process.env,
  detached: process.platform !== 'win32',
});

let shuttingDown = false;

child.on('exit', (code, signal) => {
  if (signal === 'SIGINT') {
    process.exit(130);
  }

  if (signal === 'SIGTERM') {
    process.exit(143);
  }

  process.exit(code ?? 0);
});

function stopChild(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log('');
  console.log('Stopping Expo Metro...');

  sendSignal(signal);

  setTimeout(() => sendSignal('SIGTERM'), 1200).unref();
  setTimeout(() => {
    sendSignal('SIGKILL');
    process.exit(signal === 'SIGINT' ? 130 : 143);
  }, 2500).unref();
}

function sendSignal(signal) {
  try {
    if (process.platform === 'win32') {
      child.kill(signal);
      return;
    }

    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') {
      console.error(error.message);
    }
  }
}

process.on('SIGINT', () => {
  stopChild('SIGINT');
});

process.on('SIGTERM', () => {
  stopChild('SIGTERM');
});
