function transform(input) {
  const sourceSites = input?.IDX_0 || {};
  const sourceHosts = input?.IDX_1 || {};
  const sourceDevices = input?.IDX_2 || {};

  const selectedSiteId = input?.trmnl?.plugin_settings?.custom_fields_values?.unifi_site_id;
  const showDevices = input?.trmnl?.plugin_settings?.custom_fields_values?.unifi_show_devices === "yes";

  const rawSites = Array.isArray(sourceSites.data) ? sourceSites.data : [];
  const rawHosts = Array.isArray(sourceHosts.data) ? sourceHosts.data : [];
  const rawDeviceGroups = Array.isArray(sourceDevices.data) ? sourceDevices.data : [];

  const sites = selectedSiteId
    ? rawSites.filter((site) => site?.siteId === selectedSiteId)
    : rawSites;

  // Restrict related records to only hosts tied to the selected site(s).
  const hostIds = new Set(sites.map((site) => site?.hostId).filter(Boolean));
  const hosts = hostIds.size
    ? rawHosts.filter((host) => hostIds.has(host?.id))
    : rawHosts;

  const devices = showDevices
    ? (hostIds.size
        ? rawDeviceGroups.filter((group) => hostIds.has(group?.hostId))
        : rawDeviceGroups)
    : [];

  // The console's current public egress IP (follows WAN failover). Used to
  // flag which uplink is actually carrying traffic right now.
  const hostIpById = new Map(rawHosts.map((host) => [host?.id, host?.ipAddress]));

  // Turn statistics.wans (an object keyed WAN/WAN2/WAN3) into an ordered list
  // of *connected* uplinks (those that hold a public IP), then split into the
  // active link and any standby backups.
  const buildWans = (site) => {
    const activeIp = hostIpById.get(site?.hostId);
    const wanOrder = { WAN: 0, WAN2: 1, WAN3: 2 };
    const upWans = Object.entries(site?.statistics?.wans || {})
      .sort((a, b) => (wanOrder[a[0]] ?? 99) - (wanOrder[b[0]] ?? 99))
      .filter(([, wan]) => wan?.externalIp)
      .map(([key, wan]) => ({
        id: key === "WAN" ? "WAN1" : key,
        isp: wan?.ispInfo?.name,
        ip: wan?.externalIp,
        uptime: wan?.wanUptime,
        isActive: wan?.externalIp === activeIp,
      }));
    // Prefer the link matching the egress IP; fall back to the first connected
    // uplink so we always show *something* even if the match is inconclusive.
    const active = upWans.find((wan) => wan.isActive) || upWans[0] || null;
    const backups = upWans.filter((wan) => wan !== active);
    return { active, backups };
  };

  return {
    IDX_0: {
      errorType: sourceSites.errorType,
      errorMessage: sourceSites.errorMessage,
      data: sites.map((site) => ({
        siteId: site?.siteId,
        hostId: site?.hostId,
        meta: {
          desc: site?.meta?.desc,
        },
        wans: buildWans(site),
        statistics: {
          percentages: {
            wanUptime: site?.statistics?.percentages?.wanUptime,
          },
          ispInfo: {
            name: site?.statistics?.ispInfo?.name,
          },
          counts: {
            totalDevice: site?.statistics?.counts?.totalDevice,
            wifiClient: site?.statistics?.counts?.wifiClient,
            wiredClient: site?.statistics?.counts?.wiredClient,
            offlineDevice: site?.statistics?.counts?.offlineDevice,
          },
        },
      })),
    },
    IDX_1: {
      errorType: sourceHosts.errorType,
      errorMessage: sourceHosts.errorMessage,
      data: hosts.map((host) => ({
        id: host?.id,
        reportedState: {
          name: host?.reportedState?.name,
          state: host?.reportedState?.state,
          // Public/WAN egress IP as seen by the UniFi cloud. Do NOT use
          // reportedState.ip: on consoles with Teleport enabled that field
          // holds the WireGuard remote-access overlay address (100.64.0.0/10
          // CGNAT space), not the internet-facing IP.
          ip: host?.ipAddress || host?.reportedState?.ip,
          hardware: {
            shortname: host?.reportedState?.hardware?.shortname,
          },
        },
      })),
    },
    IDX_2: {
      errorType: sourceDevices.errorType,
      errorMessage: sourceDevices.errorMessage,
      data: devices.map((group) => ({
        hostId: group?.hostId,
        devices: (Array.isArray(group?.devices) ? group.devices : []).map((device) => ({
          name: device?.name,
          status: device?.status,
          isConsole: device?.isConsole,
          model: device?.model,
          ip: device?.ip,
        })),
      })),
    },
  };
}
