const supportedTasks = [
  "WATCH_VIDEO",
  "PLAY_ON_DESKTOP",
  "STREAM_ON_DESKTOP",
  "PLAY_ACTIVITY",
  "WATCH_VIDEO_ON_MOBILE",
];

const videoConfig = {
  maxFuture: 10,
  speed: 7,
  interval: 1,
};

const moduleLoader = (() => {
  delete window.$;
  const wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, (r) => r]);
  webpackChunkdiscord_app.pop();
  const modules = Object.values(wpRequire.c);
  const find = (predicate) => {
    const mod = modules.find(predicate);
    if (!mod) throw new Error("module not found");
    return mod;
  };

  return { find };
})();

const stores = (() => {
  let applicationStreamingStore, runningGameStore, questsStore,
      channelStore, guildChannelStore, fluxDispatcher, api;
  const streamingMod = moduleLoader.find(
    (x) => x?.exports?.Z?.__proto__?.getStreamerActiveStreamMetadata
      || x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata
  );

  const isNewBundle = !!streamingMod?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata;
  if (isNewBundle) {
    applicationStreamingStore = streamingMod.exports.A;
    runningGameStore  = moduleLoader.find((x) => x?.exports?.Ay?.getRunningGames).exports.Ay;
    questsStore       = moduleLoader.find((x) => x?.exports?.A?.__proto__?.getQuest).exports.A;
    channelStore      = moduleLoader.find((x) => x?.exports?.A?.__proto__?.getAllThreadsForParent).exports.A;
    guildChannelStore = moduleLoader.find((x) => x?.exports?.Ay?.getSFWDefaultChannel).exports.Ay;
    fluxDispatcher    = moduleLoader.find((x) => x?.exports?.h?.__proto__?.flushWaitQueue).exports.h;
    api               = moduleLoader.find((x) => x?.exports?.Bo?.get).exports.Bo;
  } else {
    applicationStreamingStore = streamingMod.exports.Z;
    runningGameStore  = moduleLoader.find((x) => x?.exports?.ZP?.getRunningGames).exports.ZP;
    questsStore       = moduleLoader.find((x) => x?.exports?.Z?.__proto__?.getQuest).exports.Z;
    channelStore      = moduleLoader.find((x) => x?.exports?.Z?.__proto__?.getAllThreadsForParent).exports.Z;
    guildChannelStore = moduleLoader.find((x) => x?.exports?.ZP?.getSFWDefaultChannel).exports.ZP;
    fluxDispatcher    = moduleLoader.find((x) => x?.exports?.Z?.__proto__?.flushWaitQueue).exports.Z;
    api               = moduleLoader.find((x) => x?.exports?.tn?.get).exports.tn;
  }

  return { applicationStreamingStore, runningGameStore, questsStore, channelStore, guildChannelStore, fluxDispatcher, api };
})();

const utils = {
  randomPid: () => Math.floor(Math.random() * 30_000) + 1_000,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  getTaskConfig: (quest) => quest.config.taskConfig ?? quest.config.taskConfigV2,
  getActiveTaskName: (quest) => {
    const taskConfig = utils.getTaskConfig(quest);
    return supportedTasks.find((t) => taskConfig.tasks[t] != null);
  },

  getProgress: (quest, taskName) =>
    quest.userStatus?.progress?.[taskName]?.value ?? 0,
  log: {
    info:  (msg) => console.log(`quest ${msg}`),
    ok:    (msg) => console.log(`quest ${msg}`),
    warn:  (msg) => console.warn(`quest ${msg}`),
    error: (msg) => console.error(`quest ${msg}`),
  },
};

const taskHandlers = {
  async WATCH_VIDEO(quest, taskName) {
    const { maxFuture, speed, interval } = videoConfig;
    const { api } = stores;
    const enrolledAt    = new Date(quest.userStatus.enrolledAt).getTime();
    const secondsNeeded = utils.getTaskConfig(quest).tasks[taskName].target;
    let secondsDone     = utils.getProgress(quest, taskName);
    let completed       = false;
    utils.log.info(`spoofing video for ${quest.config.messages.questName}`);
    while (true) {
      const maxAllowed = Math.floor((Date.now() - enrolledAt) / 1000) + maxFuture;
      const canAdvance = maxAllowed - secondsDone >= speed;
      if (canAdvance) {
        const timestamp = Math.min(secondsNeeded, secondsDone + speed + Math.random());
        const res = await api.post({
          url:  `/quests/${quest.id}/video-progress`,
          body: { timestamp },
        });
        completed   = res.body.completed_at != null;
        secondsDone = Math.min(secondsNeeded, secondsDone + speed);
      }

      if (secondsDone + speed >= secondsNeeded) break;
      await utils.sleep(interval * 1000);
    }

    if (!completed) {
      await api.post({
        url:  `/quests/${quest.id}/video-progress`,
        body: { timestamp: secondsNeeded },
      });
    }

    utils.log.ok("quest completed");
  },

  async PLAY_ON_DESKTOP(quest) {
    if (typeof DiscordNative === "undefined") {
      utils.log.warn(`${quest.config.messages.questName} requires the desktop app`);
      return;
    }

    const { api, runningGameStore, fluxDispatcher } = stores;
    const taskConfig    = utils.getTaskConfig(quest);
    const secondsNeeded = taskConfig.tasks.PLAY_ON_DESKTOP.target;
    const secondsDone   = utils.getProgress(quest, "PLAY_ON_DESKTOP");
    const pid           = utils.randomPid();
    const { id: applicationId, name: applicationName } = quest.config.application;
    const res     = await api.get({ url: `/applications/public?application_ids=${applicationId}` });
    const appData = res.body[0];
    const exeName = appData.executables.find((x) => x.os === "win32").name.replace(">", "");
    const fakeGame = {
      cmdLine:     `C:\\Program Files\\${appData.name}\\${exeName}`,
      exeName,
      exePath:     `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
      hidden:      false,
      isLauncher:  false,
      id:          applicationId,
      name:        appData.name,
      pid,
      pidPath:     [pid],
      processName: appData.name,
      start:       Date.now(),
    };

    const realGames           = runningGameStore.getRunningGames();
    const origGetRunningGames = runningGameStore.getRunningGames;
    const origGetGameForPID   = runningGameStore.getGameForPID;
    runningGameStore.getRunningGames = () => [fakeGame];
    runningGameStore.getGameForPID   = (p) => (p === pid ? fakeGame : undefined);
    fluxDispatcher.dispatch({
      type:    "RUNNING_GAMES_CHANGE",
      removed: realGames,
      added:   [fakeGame],
      games:   [fakeGame],
    });

    utils.log.info(`spoofed game to ${applicationName} wait ${Math.ceil((secondsNeeded - secondsDone) / 60)} more minutes`);
    return new Promise((resolve) => {
      const onHeartbeat = (data) => {
        const progress =
          quest.config.configVersion === 1
            ? data.userStatus.streamProgressSeconds
            : Math.floor(data.userStatus.progress.PLAY_ON_DESKTOP.value);
        utils.log.info(`progress ${progress} of ${secondsNeeded}`);
        if (progress >= secondsNeeded) {
          runningGameStore.getRunningGames = origGetRunningGames;
          runningGameStore.getGameForPID   = origGetGameForPID;
          fluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: [] });
          fluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
          utils.log.ok("quest completed");
          resolve();
        }
      };

      fluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
    });
  },

  async STREAM_ON_DESKTOP(quest) {
    if (typeof DiscordNative === "undefined") {
      utils.log.warn(`${quest.config.messages.questName} requires the desktop app`);
      return;
    }

    const { applicationStreamingStore, fluxDispatcher } = stores;
    const taskConfig    = utils.getTaskConfig(quest);
    const secondsNeeded = taskConfig.tasks.STREAM_ON_DESKTOP.target;
    const secondsDone   = utils.getProgress(quest, "STREAM_ON_DESKTOP");
    const pid           = utils.randomPid();
    const { id: applicationId, name: applicationName } = quest.config.application;
    const origMetadata = applicationStreamingStore.getStreamerActiveStreamMetadata;
    applicationStreamingStore.getStreamerActiveStreamMetadata = () => ({
      id:         applicationId,
      pid,
      sourceName: null,
    });

    utils.log.info(`spoofed stream to ${applicationName} stream any window in vc for ${Math.ceil((secondsNeeded - secondsDone) / 60)} minutes you need at least 1 other person in vc`);
    return new Promise((resolve) => {
      const onHeartbeat = (data) => {
        const progress =
          quest.config.configVersion === 1
            ? data.userStatus.streamProgressSeconds
            : Math.floor(data.userStatus.progress.STREAM_ON_DESKTOP.value);
        utils.log.info(`progress ${progress} of ${secondsNeeded}`);
        if (progress >= secondsNeeded) {
          applicationStreamingStore.getStreamerActiveStreamMetadata = origMetadata;
          fluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
          utils.log.ok("quest completed");
          resolve();
        }
      };

      fluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
    });
  },

  async PLAY_ACTIVITY(quest) {
    const { api, channelStore, guildChannelStore } = stores;
    const taskConfig    = utils.getTaskConfig(quest);
    const secondsNeeded = taskConfig.tasks.PLAY_ACTIVITY.target;
    const channelId =
      channelStore.getSortedPrivateChannels()[0]?.id
      ?? Object.values(guildChannelStore.getAllGuilds())
               .find((g) => g?.VOCAL?.length > 0)
               ?.VOCAL[0].channel.id;

    const streamKey = `call:${channelId}:1`;
    utils.log.info(`completing activity quest ${quest.config.messages.questName}`);
    while (true) {
      const res      = await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: false } });
      const progress = res.body.progress.PLAY_ACTIVITY.value;
      utils.log.info(`progress ${progress} of ${secondsNeeded}`);
      if (progress >= secondsNeeded) {
        await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: true } });
        break;
      }

      await utils.sleep(20_000);
    }

    utils.log.ok("quest completed");
  },
};

taskHandlers.WATCH_VIDEO_ON_MOBILE = taskHandlers.WATCH_VIDEO;
const questRunner = {
  getEligibleQuests() {
    return [...stores.questsStore.quests.values()].filter((quest) => {
      const { userStatus, config } = quest;
      if (!userStatus?.enrolledAt) return false;
      if (userStatus?.completedAt) return false;
      if (new Date(config.expiresAt) <= Date.now()) return false;

      return !!utils.getActiveTaskName(quest);
    });
  },

  async run() {
    const quests = this.getEligibleQuests();
    if (quests.length === 0) {
      utils.log.warn("no uncompleted quests found");
      return;
    }

    utils.log.info(`found ${quests.length} quest to complete`);
    for (const quest of quests) {
      const taskName = utils.getActiveTaskName(quest);
      utils.log.info(`starting ${quest.config.messages.questName} task ${taskName}`);
      const handler = taskHandlers[taskName];
      if (!handler) {
        utils.log.error(`no handler for task ${taskName} skipping`);
        continue;
      }

      await handler(quest, taskName);
    }

    utils.log.ok("all quests done");
  },
};

questRunner.run();
