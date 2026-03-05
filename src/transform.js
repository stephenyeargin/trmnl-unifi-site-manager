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
          ip: host?.reportedState?.ip,
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
