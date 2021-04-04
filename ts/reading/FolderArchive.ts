import { FileParseError, FileNotFoundError } from '../utils/Errors';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
// @ts-ignore
import json from 'big-json';
import Settings from '../utils/Settings';
import fs from 'fs';
import path from 'path';
import { Archive, BaseArchive } from './StreamArchive';

type EntryDict = { [file: string]: FolderEntry };
export type FolderEntry = {
  path: string;
  stat: fs.Stats;
  name: string;
  relative_path: string;
};

export class FolderArchive implements BaseArchive<FolderEntry> {
  protected _ready: Promise<void> = Promise.resolve();
  protected root_dir = '';
  protected entries: EntryDict = {};
  public events = new EventEmitter;

  constructor(archive: string | FolderArchive) {
    if (archive instanceof FolderArchive) {
      this.entries = { ...archive.entries };
      this.root_dir = archive.root_dir;
      this._ready = archive._ready;
    }
    else {
      if (path.isAbsolute(archive)) {
        this.root_dir = archive;
      }
      else {
        this.root_dir = path.normalize(process.cwd() + '/' + archive);
      }

      this._ready = new Promise((resolve, reject) => {
        this.getEntries('')
          .then(entries => {
            this.entries = entries;
            resolve();
          })
          .catch(reject);
      });
    }
  }

  protected async getEntries(from_directory: string) {
    const absolute_path = this.root_dir + (from_directory ? '/' + from_directory : '');

    const current_dir_entries = await fs.promises.readdir(absolute_path, { withFileTypes: true });
    const entries: EntryDict = {};

    await Promise.all(current_dir_entries.map(async entry => {
      const normalized_path = path.normalize(absolute_path + '/' + entry.name);
      const relative_path = from_directory ? (from_directory + '/' + entry.name) : entry.name;

      if (entry.isFile()) {
        entries[relative_path] = {
          relative_path,
          path: normalized_path,
          name: entry.name,
          stat: await fs.promises.stat(normalized_path),
        };
      }
      else if (entry.isDirectory()) {
        Object.assign(entries, await this.getEntries(relative_path));
      }
    }));

    return entries;
  }

  dir(dir_name: string) {
    const copy = new FolderArchive(this);

    if (dir_name.endsWith('/')) {
      dir_name = dir_name.slice(0, dir_name.length - 1);
    }

    const trimmed_entries: EntryDict = {};
    const name_regex = new RegExp('^' + dir_name + '/');
    const to_delete: string[] = [];

    for (const [name, entry] of Object.entries(copy.entries)) {
      if (!name.match(name_regex)) {
        to_delete.push(name);
      }

      trimmed_entries[this.ltrim(name, dir_name + "/")] = entry;
    }

    copy.entries = trimmed_entries;
    copy.root_dir = path.normalize(copy.root_dir + '/' + dir_name);

    // Delete no valid entries
    for (const name of to_delete) {
      delete copy.entries[name];
    }

    return copy;
  }

  has(name: string) {
    return this.search(new RegExp(`^${name}$`)).length > 0;
  }

  search(query: RegExp) {
    return Object.entries(this.files)
      .filter(f => !!f[0].match(query))
      .map(f => f[1]);
  }

  searchDir(query: RegExp) {
    return Object.entries(this.dirs)
      .filter(f => f[0].match(query))
      .map(f => f[1]);
  }

  ready() {
    return this._ready;
  }

  ls(current_dir_only = true) {
    const l = this.entries;
    const files: { [name: string]: FolderEntry } = {};

    for (const key in l) {
      if (current_dir_only && key.match(/\/.+$/)) {
        continue;
      }

      files[key] = l[key];
    }

    return files;
  }

  get(
    name: string,
    type: "text"
      | "arraybuffer"
      | "blob"
    = "text",
    parse_auto = true
  ) {
    const f = this.entries[name];

    if (!f) {
      this.events.emit('read error', { filename: name });
      throw new FileNotFoundError("File not found: " + name, name);
    }

    return this.read(f, type, parse_auto);
  }

  read(
    file: FolderEntry,
    type: "text"
      | "arraybuffer"
      | "blob"
    = "text",
    parse_auto = true
  ) {
    const fp = fs.promises.readFile(file.path);

    function bufferToStream(binary: Buffer) {
      const readableInstanceStream = new Readable({
        read() {
          this.push(binary);
          this.push(null);
        }
      });

      return readableInstanceStream;
    }

    if (parse_auto) {
      return fp.then(data => {
        if (type === "text") {
          const EQUAL_CHAR_CODE = 61;
          const LINE_FEED_CHAR_CODE = 10;

          let start_pos = 0;
          let length = data.length;
          for (let i = 0; i < length && i < 1024 && data[i] !== LINE_FEED_CHAR_CODE; i++) {
            // Buffer code for "=" character (in utf8 or ascii)
            if (data[i] === EQUAL_CHAR_CODE) {
              start_pos = i + 1;
              break;
            }
          }

          const buffer_part = data.slice(start_pos);

          // > {LAZY_JSON_THRESHOLD} Mo
          if (Settings.LAZY_JSON_PARSE && buffer_part.length > Settings.LAZY_JSON_THRESHOLD * 1024 * 1024) {
            return new Promise((resolve, reject) => {
              const stream_buffer = bufferToStream(buffer_part);
              const parseStream = json.createParseStream();

              parseStream.on('data', function(obj: any) {
                // for an unknown reason,
                // arrays are not specified with the right prototype
                if ('0' in obj) {
                  // Setting prototype does not work,
                  // So we're just getting an array from the object.
                  resolve(Object.values(obj));
                }
                else {
                  resolve(obj);
                }
              });
              parseStream.on('error', function(err: any) {
                reject(err);
              });

              stream_buffer.pipe(parseStream);
            }).catch(e => {
              if (e instanceof Error) {
                throw new FileParseError(
                  `Unexpected SyntaxError at JSON.parse when reading a file (${file.relative_path}): ${e.message}`,
                  file.relative_path,
                  ""
                );
              }
              throw e;
            }) as any;
          }

          const buffer_as_text = buffer_part.toString();
          try {
            return JSON.parse(buffer_as_text);
          } catch (e) {
            if (e instanceof SyntaxError) {
              throw new FileParseError(
                `Unexpected SyntaxError at JSON.parse when reading a file (${file.name}): ${e.message}`,
                file.name,
                buffer_as_text
              );
            }
            throw e;
          }
        }

        const ab = new ArrayBuffer(data.length);
        const view = new Uint8Array(ab);
        for (let i = 0; i < data.length; ++i) {
          view[i] = data[i];
        }

        if (type === "arraybuffer") {
          return ab;
        }
        else {
          throw new Error('Blob is not supported on Node.js systems.');
        }
      });
    }
    else {
      return fp;
    }
  }

  async fromFile(name: string | FolderEntry) {
    let f: ArrayBuffer;
    if (typeof name === 'string') {
      f = await this.get(name, "arraybuffer", false);
    }
    else {
      f = await this.read(name, "arraybuffer", false);
    }
    return new Archive(f);
  }

  protected get files() {
    const o: EntryDict = {};
    for (const [name, entry] of Object.entries(this.entries)) {
      if (!entry.stat.isDirectory()) {
        o[name] = entry;
      }
    }

    return o;
  }

  protected get dirs() {
    const o: EntryDict = {};
    for (const [name, entry] of Object.entries(this.entries)) {
      if (entry.stat.isDirectory()) {
        o[name] = entry;
      }
    }

    return o;
  }

  protected ltrim(name: string, left_str: string) {
    if (name.startsWith(left_str))
      return name.slice(left_str.length);
    return name;
  }
}
