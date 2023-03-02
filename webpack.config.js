const path = require('path');

module.exports = [
  {
    entry: './src/lib/transformsSrc/grouped_loader.js',
    module: {},
    resolve: {
      extensions: ['.js'],
    },
    output: {
      filename: 'grouped_loader.js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'loader',
        type: 'assign',
        export: 'default',
      },
    },
  },
  {
    entry: './src/lib/transformsSrc/pg_loader.js',
    module: {},
    resolve: {
      extensions: ['.js'],
    },
    output: {
      filename: 'pg_loader.js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'loader',
        type: 'assign',
        export: 'default',
      },
    },
  },
  {
    entry: './src/lib/transformsSrc/python_loader.js',
    module: {},
    resolve: {
      extensions: ['.js'],
    },
    output: {
      filename: 'python_loader.js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'loader',
        type: 'assign',
        export: 'default',
      },
    },
  },
  {
    entry: './src/lib/transformsSrc/fromto_loader.js',
    module: {},
    resolve: {
      extensions: ['.js'],
    },
    output: {
      filename: 'fromto_loader.js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'loader',
        type: 'assign',
        export: 'default',
      },
    },
  },
  {
    entry: './src/lib/transformsSrc/pg_all_loader.js',
    module: {},
    resolve: {
      extensions: ['.js'],
    },
    output: {
      filename: 'pg_all_loader.js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'loader',
        type: 'assign',
        export: 'default',
      },
    },
  },
  {
    entry: './src/lib/transformsSrc/eval_loader.js',
    module: {},
    resolve: {
      extensions: ['.js'],
    },
    output: {
      filename: 'eval_loader.js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'loader',
        type: 'assign',
        export: 'default',
      },
    },
  },
  {
    entry: './src/lib/transformsSrc/pg_SL_loader.js',
    module: {},
    resolve: {
      extensions: ['.js'],
    },
    output: {
      filename: 'pg_SL_loader.js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'loader',
        type: 'assign',
        export: 'default',
      },
    },
  },
  {
    entry: './src/lib/transformsSrc/pg_ML_loader.js',
    module: {},
    resolve: {
      extensions: ['.js'],
    },
    output: {
      filename: 'pg_ML_loader.js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'loader',
        type: 'assign',
        export: 'default',
      },
    },
  },
  // },
  // {
  //   entry: './src/index.ts',
  //   devtool: 'inline-source-map',
  //   module: {
  //     rules: [
  //       {
  //         test: /\.tsx?$/,
  //         use: 'ts-loader',
  //         exclude: /node_modules/,
  //       },
  //     ],
  //   },
  //   resolve: {
  //     extensions: ['.ts', '.js'],
  //   },
  //   output: {
  //     filename: 'bundle.js',
  //     path: path.resolve(__dirname, 'dist'),
  //   },
  // },
];
