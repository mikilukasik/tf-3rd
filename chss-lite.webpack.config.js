const path = require('path');

module.exports = [
  {
    entry: './src/chss-lite.js',
    module: {},
    resolve: {
      extensions: ['.js'],
    },
    output: {
      filename: 'chss-lite.js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'loader',
        type: 'assign',
        export: 'default',
      },
    },
  },
  {
    entry: './src/chss-lite2.js',
    module: {},
    resolve: {
      extensions: ['.js'],
    },
    output: {
      filename: 'chss-lite2.js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'loader',
        type: 'assign',
        export: 'default',
      },
    },
  },
  // {
  //   entry: './src/chss-lite.ts',
  //   devtool: 'inline-source-map',
  //   module: {
  //     rules: [
  //       {
  //         test: /\.(t|j)sx?$/,
  //         use: 'ts-loader',
  //         // exclude: [/node_modules/, path.resolve(__dirname, 'chss-module-engine')],
  //         include: path.resolve(__dirname, 'src'),
  //       },
  //     ],
  //   },
  //   resolve: {
  //     extensions: ['.ts', '.js'],
  //   },
  //   output: {
  //     filename: 'chss-lite.js',
  //     path: path.resolve(__dirname, 'dist'),
  //   },
  // },
];
