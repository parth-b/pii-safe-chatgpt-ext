const path = require('path');

module.exports = {
  entry: './src/content.js',
  output: {
    filename: 'content.js',
    path: path.resolve(__dirname, 'dist')
  },
  mode: 'production',
  optimization: {
    minimize: true
  },
  resolve: {
    fallback: {
      "fs": false,
      "path": false
    }
  }
}; 