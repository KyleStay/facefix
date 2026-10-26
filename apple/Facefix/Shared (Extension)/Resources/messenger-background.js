// Loaded only by Safari packaging. Persistent registrations are reconciled on updates.
(() => {
  const api = chrome;
  const config = FacefixMessenger;
  let pending = Promise.resolve();
  function enqueue(operation) {
    const result = pending.then(operation);
    pending = result.catch(() => {});
    return result;
  }
  async function reconcile() {
    const {enabled = true} = await api.storage.local.get({enabled: true});
    const wanted = enabled !== false;
    const registered = (await api.scripting.getRegisteredContentScripts()).find(script => script.id === config.scriptID);
    const previousEnabled = (await api.declarativeNetRequest.getEnabledRulesets()).includes(config.ruleset);
    try {
      if (wanted) {
        const desired = {id: config.scriptID, matches: config.sites.map(site => site + '/*'),
          js: ['messenger-identity.js'], world: 'MAIN', runAt: 'document_start', persistAcrossSessions: true};
        if (registered) await api.scripting.updateContentScripts([desired]);
        else await api.scripting.registerContentScripts([desired]);
      }
      await api.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: wanted ? [config.ruleset] : [], disableRulesetIds: wanted ? [] : [config.ruleset]
      });
      if (!wanted && registered) await api.scripting.unregisterContentScripts({ids: [config.scriptID]});
      return {ok: true, enabled: wanted};
    } catch (error) {
      if (wanted) {
        // Restore the previous registration/rules if enabling failed halfway.
        try {
          if (registered) await api.scripting.updateContentScripts([registered]);
          else await api.scripting.unregisterContentScripts({ids: [config.scriptID]});
          await api.declarativeNetRequest.updateEnabledRulesets({enableRulesetIds: previousEnabled ? [config.ruleset] : [], disableRulesetIds: previousEnabled ? [] : [config.ruleset]});
        } catch { /* The popup still reports failure; never claim successful setup. */ }
      }
      throw error;
    }
  }
  const start = () => enqueue(reconcile).catch(() => {});
  api.runtime.onInstalled.addListener(start);
  api.runtime.onStartup.addListener(start);
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) start();
  });
  api.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== api.runtime.id || sender.url !== api.runtime.getURL('popup.html') || message?.type !== 'facefix-messenger-status') return;
    enqueue(reconcile).then(reply, () => reply({ok: false, message: 'Could not enable desktop messaging. Reopen Facefix and try again.'}));
    return true;
  });
  start();
})();
