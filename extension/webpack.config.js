const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: argv.mode,
    entry: {
      background: './src/background/index.ts',
      content: './src/content/index.ts',
      sidepanel: './src/pages/sidepanel/index.tsx'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      publicPath: '/'
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/pages/sidepanel/index.html',
        filename: 'sidepanel.html',
        chunks: ['sidepanel'],
      }),
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'manifest.json', to: '' },
          { from: 'src/assets/icons', to: 'assets/icons' },
          { from: 'src/styles/promptShortcut.css', to: 'styles/promptShortcut.css' },
          { from: 'src/styles/design-tokens.css', to: 'styles/design-tokens.css' },
          { from: 'src/styles/toast.css', to: 'styles/toast.css' },
          { from: 'src/styles/promptShortcutUI.css', to: 'styles/promptShortcutUI.css' }
        ],
      }),
      new Dotenv({
        path: isProduction ? './.env.production' : './.env.development',
        systemvars: true
      })
    ],
    devtool: isProduction ? false : 'cheap-module-source-map',
  };
};