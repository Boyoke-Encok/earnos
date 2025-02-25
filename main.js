const fs = require("fs");
const path = require("path");
const axios = require("axios");
const colors = require("colors");
const { HttpsProxyAgent } = require("https-proxy-agent");
const readline = require("readline");
const user_agents = require("./config/userAgents");
const settings = require("./config/config");
const { sleep, loadData, getRandomNumber, saveToken, isTokenExpired, saveJson, updateEnv, decodeJWT } = require("./utils");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const { checkBaseUrl } = require("./checkAPI");
const headers = require("./core/header");

class ClientAPI {
  constructor(queryId, accountIndex, proxy, baseURL, localStorage) {
    this.headers = headers;
    this.baseURL = baseURL;
    this.queryId = queryId;
    this.accountIndex = accountIndex;
    this.proxy = proxy;
    this.proxyIP = null;
    this.session_name = null;
    this.session_user_agents = this.#load_session_data();
    this.token = queryId;
    this.localStorage = localStorage;
    this.localData = {};
  }

  #load_session_data() {
    try {
      const filePath = path.join(process.cwd(), "session_user_agents.json");
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      } else {
        throw error;
      }
    }
  }

  #get_random_user_agent() {
    const randomIndex = Math.floor(Math.random() * user_agents.length);
    return user_agents[randomIndex];
  }

  #get_user_agent() {
    if (this.session_user_agents[this.session_name]) {
      return this.session_user_agents[this.session_name];
    }

    console.log(`[Tài khoản ${this.accountIndex + 1}] Tạo user agent...`.blue);
    const newUserAgent = this.#get_random_user_agent();
    this.session_user_agents[this.session_name] = newUserAgent;
    this.#save_session_data(this.session_user_agents);
    return newUserAgent;
  }

  #save_session_data(session_user_agents) {
    const filePath = path.join(process.cwd(), "session_user_agents.json");
    fs.writeFileSync(filePath, JSON.stringify(session_user_agents, null, 2));
  }

  #get_platform(userAgent) {
    const platformPatterns = [
      { pattern: /iPhone/i, platform: "ios" },
      { pattern: /Android/i, platform: "android" },
      { pattern: /iPad/i, platform: "ios" },
    ];

    for (const { pattern, platform } of platformPatterns) {
      if (pattern.test(userAgent)) {
        return platform;
      }
    }

    return "Unknown";
  }

  #set_headers() {
    const platform = this.#get_platform(this.#get_user_agent());
    this.headers["sec-ch-ua"] = `Not)A;Brand";v="99", "${platform} WebView";v="127", "Chromium";v="127`;
    this.headers["sec-ch-ua-platform"] = platform;
    this.headers["User-Agent"] = this.#get_user_agent();
  }

  createUserAgent() {
    try {
      const info = decodeJWT(this.queryId);
      const { email } = info;
      this.session_name = email;
      this.#get_user_agent();
    } catch (error) {
      this.log(`Can't create user agent, try get new query_id: ${error.message}`, "error");
      return;
    }
  }

  async log(msg, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const accountPrefix = `[Akun ${this.accountIndex + 1}]`;
    const ipPrefix = this.proxyIP ? `[${this.proxyIP}]` : "[Local IP]";
    let logMessage = "";

    switch (type) {
      case "success":
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.green;
        break;
      case "error":
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.red;
        break;
      case "warning":
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.yellow;
        break;
      case "custom":
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.magenta;
        break;
      default:
        logMessage = `${accountPrefix}${ipPrefix} ${msg}`.blue;
    }
    console.log(logMessage);
  }

  async checkProxyIP() {
    try {
      const proxyAgent = new HttpsProxyAgent(this.proxy);
      const response = await axios.get("https://api.ipify.org?format=json", { httpsAgent: proxyAgent });
      if (response.status === 200) {
        this.proxyIP = response.data.ip;
        return response.data.ip;
      } else {
        throw new Error(`Cannot check proxy IP. Status code: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Error checking proxy IP: ${error.message}`);
    }
  }

  async makeRequest(
    url,
    method,
    data = {},
    options = {
      retries: 1,
      isAuth: false,
    }
  ) {
    const { retries, isAuth } = options;

    const headers = {
      ...this.headers,
    };

    if (!isAuth) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const proxyAgent = new HttpsProxyAgent(this.proxy);
    let currRetries = 0,
      success = false;
    do {
      try {
        const response = await axios({
          method,
          url: `${url}`,
          data,
          headers,
          httpsAgent: proxyAgent,
          timeout: 30000,
        });
        success = true;
        if (response?.data?.data) return { success: true, data: response.data.data };
        return { success: true, data: response.data };
      } catch (error) {
        if (error.status == 400) {
          this.log(`Invalid request for ${url}, maybe have new update from server | contact: https://t.me/BoyokeEncok2 to get new update!`, "error");
          process.exit(0);
        }
        this.log(`Permintaan gagal: ${url} | ${error.message} | mencoba lagi...`, "warning");
        success = false;
        await sleep(settings.DELAY_BETWEEN_REQUESTS);
        if (currRetries == retries) return { success: false, error: error.message };
      }
      currRetries++;
    } while (currRetries <= retries && !success);
  }

  async getUserInfo() {
    return this.makeRequest(`${this.baseURL}/me`, "get");
  }

  async checkin() {
    return this.makeRequest(`${this.baseURL}/check-in`, "post", {});
  }

  async getSpin() {
    return this.makeRequest(`${this.baseURL}/my-spinRecords`, "get");
  }

  async spin() {
    return this.makeRequest(`${this.baseURL}/draw`, "post", {});
  }

  async handleCheckIn() {
    try {
      let proxyAgent = null;
      if (settings.USE_PROXY) {
        proxyAgent = new HttpsProxyAgent(this.proxy);
      }

      const response = await axios({
        method: "POST",
        url: "https://api.earnos.com/trpc/streak.checkIn?batch=1",
        headers: {
          authority: "api.earnos.com",
          accept: "*/*",
          "accept-language": "en-US,en;q=0.7",
          authorization: `Bearer ${this.token.trim()}`,
          "content-type": "application/json",
          origin: "https://app.earnos.com",
          referer: "https://app.earnos.com/",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        },
        httpsAgent: proxyAgent,
        data: {
          0: {
            json: null,
            meta: {
              values: ["undefined"],
            },
          },
        },
      });

      if (response.data[0]?.result?.data?.json?.success) {
        this.log(`Check-in successful! | ${new Date().toLocaleString()}`, "success");
        saveJson(this.session_name, { lastCheckIn: new Date() }, "localStorage.json");
        return true;
      } else {
        console.log(`Check-in failed: `.yellow, response.data);
        return false;
      }
    } catch (error) {
      console.log(`Error performing check-in: `.red, error.response?.data || error.message);
      return false;
    }
  }

  async getValidToken() {
    const existingToken = this.token;
    const isExp = isTokenExpired(existingToken);
    if (existingToken && !isExp) {
      this.log("Using valid token", "success");
      return existingToken;
    } else {
      this.log("Token expired...", "warning");
      saveJson(this.session_name, this.token, "tokenExp.json");
      return null;
    }
  }

  async runAccount() {
    const info = decodeJWT(this.queryId);
    const { email, username, exp } = info;
    if (Math.floor(Date.now() / 1000) > exp) {
      console.log(`Account ${i + 1} | ${username || email} Token expired=============`.yellow);
      return null;
    }
    const accountIndex = this.accountIndex;
    this.session_name = email;
    this.#set_headers();
    this.localData = this.localStorage[email];

    if (settings.USE_PROXY) {
      try {
        this.proxyIP = await this.checkProxyIP();
      } catch (error) {
        this.log(`Cannot check proxy IP: ${error.message}`, "warning");
        return;
      }
      const timesleep = getRandomNumber(settings.DELAY_START_BOT[0], settings.DELAY_START_BOT[1]);
      console.log(`=========Akun ${accountIndex + 1} | ${username || email} | ${this.proxyIP} | Mulai nanti ${timesleep} Kedua...`.green);

      await sleep(timesleep);
    }

    const token = await this.getValidToken();
    if (!token) return this.log(`Can't get token for account ${this.accountIndex + 1}, skipping...`, "error");

    if (true) {
      this.log(`Email: ${this.session_name} | Name: ${username} `, "custom");
      const lastCheckIn = this.localData?.lastCheckIn;
      if (!isCheckedInToday(lastCheckIn) || !lastCheckIn) {
        this.log("Starting check in...");
        await sleep(1);
        await this.handleCheckIn();
      } else {
        this.log("You checked in today..".yellow);
      }
    }
  }
}
const isCheckedInToday = (checkInDate) => {
  const checkIn = new Date(checkInDate);
  const today = new Date();

  // Set the time of both dates to midnight (00:00:00) for comparison
  checkIn.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return checkIn.getTime() === today.getTime(); // Returns true if checked in today
};

async function runWorker(workerData) {
  const { queryId, accountIndex, proxy, hasIDAPI, localStorage } = workerData;
  const to = new ClientAPI(queryId, accountIndex, proxy, hasIDAPI, localStorage);
  try {
    await Promise.race([to.runAccount(), new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 24 * 60 * 60 * 1000))]);
    parentPort.postMessage({
      accountIndex,
    });
  } catch (error) {
    parentPort.postMessage({ accountIndex, error: error.message });
  } finally {
    if (!isMainThread) {
      parentPort.postMessage("taskComplete");
    }
  }
}

async function main() {
  const queryIds = loadData("tokens.txt");
  const proxies = loadData("proxy.txt");
  const localStorage = require("./localStorage.json");

  if (queryIds.length > proxies.length && settings.USE_PROXY) {
    console.log("Anda sedang mengonfigurasi untuk menggunakan proxy | Jumlah proxy dan data harus sama. | Jika tidak gunakan proxy USE_PROXY=false di file .env".red);
    console.log(`Data: ${queryIds.length}`);
    console.log(`Proxy: ${proxies.length}`);
    process.exit(1);
  }
  console.log("BOT INI DI KEMBANGKAN OLEH BOYOKE ENCOK".yellow);
  if (!settings.USE_PROXY) {
    console.log(`You are running bot without proxies!!!`.yellow);
  }
  let maxThreads = settings.USE_PROXY ? settings.MAX_THEADS : settings.MAX_THEADS_NO_PROXY;

  const { endpoint: hasIDAPI, message } = await checkBaseUrl();
  if (!hasIDAPI) return console.log(`Tidak dapat menemukan ID API, coba lagi nanti!`.red);
  console.log(`${message}`.yellow);
  // process.exit();
  queryIds.map((val, i) => new ClientAPI(val, i, proxies[i], hasIDAPI, {}).createUserAgent());

  await sleep(1);
  while (true) {
    let currentIndex = 0;
    const errors = [];

    while (currentIndex < queryIds.length) {
      const workerPromises = [];
      const batchSize = Math.min(maxThreads, queryIds.length - currentIndex);
      for (let i = 0; i < batchSize; i++) {
        const worker = new Worker(__filename, {
          workerData: {
            hasIDAPI,
            queryId: queryIds[currentIndex],
            accountIndex: currentIndex,
            proxy: proxies[currentIndex % proxies.length],
            localStorage,
          },
        });

        workerPromises.push(
          new Promise((resolve) => {
            worker.on("message", (message) => {
              if (message === "taskComplete") {
                worker.terminate();
              }
              if (settings.ENABLE_DEBUG) {
                console.log(message);
              }
              resolve();
            });
            worker.on("error", (error) => {
              console.log(`Kesalahan pekerja untuk akun ${currentIndex}: ${error.message}`);
              worker.terminate();
              resolve();
            });
            worker.on("exit", (code) => {
              worker.terminate();
              if (code !== 0) {
                errors.push(`Pekerja untuk akun tersebut ${currentIndex} keluar dengan kode: ${code}`);
              }
              resolve();
            });
          })
        );

        currentIndex++;
      }

      await Promise.all(workerPromises);

      if (errors.length > 0) {
        errors.length = 0;
      }

      if (currentIndex < queryIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    await sleep(3);
    console.log("BOT INI DIKEMBANGKAN OLEH BOYOKE ENCOK".yellow);
    console.log(`=============Done semua akun | Tunggu ${settings.TIME_SLEEP} Menit=============`.magenta);
    await sleep(settings.TIME_SLEEP * 60);
  }
}

if (isMainThread) {
  main().catch((error) => {
    console.log("Kesalahan:", error);
    process.exit(1);
  });
} else {
  runWorker(workerData);
}
