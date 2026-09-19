module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '../../.env',
        safe: false,
        allowUndefined: true,
        allowlist: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GPT_ENDPOINT_URL'],
      },
    ],
  ],
};
