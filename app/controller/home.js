'use strict';

const Controller = require('egg').Controller;
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const md5 = require('md5');

class HomeController extends Controller {
  async index() {
    const { ctx } = this;
    const base = ctx.query.base || ctx.request.params;
    let token = process.env.TOKEN.split(',');
    const url = await this.decode(base);
    // const url = 'https://www.dropbox.com/s/cdj2e8nfas0yqmv/CleanShot-2019-12-16-at-18.18.06-2x.png?dl=1&raw=1';
    const suffix = url.split('.').pop().split('\n')[0].split('?')[0];
    const name = decodeURIComponent(url.split('/').pop().split('?')[0]);
    const imageName = `${path.resolve(__dirname, '../public/images')}/${md5(url)}.${suffix}`;
    let info;
    token.forEach(el => {
      if (this.app.dir[el]) {
        info = this.app.dir[el][name];
        if (info)token = el;
      }
    });
    if (!info) {
      token.forEach(el => {
        this.traverseDir('', el);
      });

      ctx.body = '没有请求资源,请稍后再试';
      return;
    }

    if (fs.existsSync(imageName)) {
      const buf = fs.readFileSync(imageName);
      if ([ 'png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'psd', 'svg', 'tiff' ].
        indexOf(suffix.toLowerCase()) !== -1) {
        ctx.set('content-type', `image/${suffix}`);
      }
      ctx.body = buf;
      return;
    }
    const data = await ctx.curl('https://content.dropboxapi.com/2/files/download', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': this.http_header_safe_json({ path: `${info.path_lower}` }),
      },
      method: 'POST',
    });
    if ([ 'png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'psd', 'svg', 'tiff' ].
      indexOf(suffix.toLowerCase()) !== -1) {
      ctx.set('content-type', `image/${suffix}`);
    }
    this.writeImage(path.resolve(__dirname, `../public/images/${name}`), data.data);
    // ctx.set('content-type', 'image/png');
    ctx.body = data.data;
  }

  http_header_safe_json(v) {
    const charsToEncode = /[\u007f-\uffff]/g;
    return JSON.stringify(v).replace(charsToEncode,
      function(c) {
        return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
      }
    );
  }

  /**
   * 遍历
   * @param {*} path 路径
   * @param {*} token token
   */
  async traverseDir(path = '', token) {
    const { ctx } = this;
    await new Promise(resolve => setTimeout(resolve, 500));
    const result = await ctx.curl('https://api.dropboxapi.com/2/files/list_folder', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        path,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false,
      },
      method: 'POST',
    });
    try {
      const data = JSON.parse(result.data.toString());
      if (data.entries) {
        for (let i = 0; i < data.entries.length; i++) {
          const el = data.entries[i];
          this.app.dir = { [token]: { [el.name]: el } };
          if (el['.tag'] === 'folder' && el.path_lower !== 'workspace') { await this.traverseDir(el.path_lower, token); }
        }
      }
      if (data.has_more && data.cursor) await this.syncDir(data.cursor, token);
    } catch (error) {
      console.log(error);
    }
  }

  async syncDir(cursor, token) {
    const { ctx } = this;
    const results = await ctx.curl('https://api.dropboxapi.com/2/files/list_folder/continue', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        cursor,
      },
      method: 'POST',
    });
    try {
      const data = JSON.parse(results.data.toString());
      if (data.entries) {
        data.entries.forEach(el => {
          this.app.dir = { [token]: { [el.name]: el } };
        });
      }
      if (data.has_more && data.cursor) await this.syncDir(data.cursor);
    } catch (error) {
      console.log(error);
    }
  }
  /**
   * 解密
   * @param {string} data base64转码
   */
  async decode(data) {
    const PW = process.env.PW;
    const way = path.resolve(__dirname, '../public/private.key');
    return new Promise((res, rej) => {
      exec(`echo ${data} | base64 -d | openssl rsautl -decrypt -inkey ${way} -passin pass:${PW}`, (err, stdout) => {
        if (err) {
          console.log(err);
          rej(err);
        }
        console.log(`stdout: ${stdout}`);
        res(stdout);
      });
    });
  }

  /**
   * 存入图片
   * @param name 图片名
   * @param buf 图片buffer
   * @return {Promise<void>}
   */
  async writeImage(name, buf) {
    return new Promise((res, rej) => {
      fs.writeFile(name, buf, function(err) {
        if (err) { rej(err); }
        res();
      });
    });
  }
}

module.exports = HomeController;
