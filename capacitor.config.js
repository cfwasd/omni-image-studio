const config = {
  appId: 'vip.wangziheng.omniimage',
  appName: 'OmniImage Studio',
  webDir: 'public',
  server: {
    // 部署后替换为您的公网域名（如 https://image.wangziheng.vip）
    url: 'https://image.wangziheng.vip',
    cleartext: false,
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false,
    captureInput: true
  },
  ios: {
    contentInset: 'always'
  }
};

module.exports = config;
