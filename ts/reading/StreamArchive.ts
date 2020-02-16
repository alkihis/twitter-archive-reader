import JSZip from 'jszip';
import StreamZip, { ZipEntry } from './StreamZip';
import { FileParseError, FileNotFoundError } from '../utils/Errors';
import { EventEmitter } from 'events';

/**
 * string: Filename. WILL USE STREAMING METHOD.
 * 
 * number[] | Uint8Array | ArrayBuffer: Array of bytes
 * 
 * Blob: File for browser. WILL USE STREAMING METHOD.
 * 
 * JSZip | Archive: Existing archives
 */
export type AcceptedZipSources = string | number[] | Uint8Array | ArrayBuffer | Blob | JSZip | Archive;
export type ConstructibleArchives = BaseArchive<ZipEntry> | BaseArchive<JSZip.JSZipObject>;

export interface BaseArchive<T> {
  ready: () => Promise<void>;
  dir: (name: string) => BaseArchive<T>;
  has: (name: string) => boolean;
  search: (query: RegExp) => T[];
  searchDir: (query: RegExp) => T[];
  get: (
    name: string, 
    type?: "text" 
      | "arraybuffer" 
      | "blob",
    parse_auto?: boolean
  ) => Promise<any>;
  read: (
    file: T, 
    type?: "text" 
      | "arraybuffer" 
      | "blob",
    parse_auto?: boolean
  ) => Promise<any>;
  ls: (current_dir_only?: boolean) => { [name: string]: T };
  fromFile: (name: string | T) => Promise<Archive>;
  events: EventEmitter;
}

export function constructArchive(archive: AcceptedZipSources) : ConstructibleArchives {
  if (
    typeof archive === 'string' ||
    (typeof Blob !== 'undefined' && archive instanceof Blob)
  ) {
    // Streaming method
    return new StreamArchive(archive);
  }
  else {
    // classic method
    return new Archive(archive);
  }
}

type EntryDict = { [file: string]: ZipEntry };
class StreamArchive implements BaseArchive<ZipEntry> {
  protected s_zip: StreamZip<any, any>;
  protected _ready: Promise<void> = Promise.resolve();
  protected current_dir = "";
  protected entries: EntryDict = {};
  public events = new EventEmitter;

  constructor(archive: Blob | string | StreamArchive) {
    if (archive instanceof StreamArchive) {
      this.s_zip = archive.s_zip;
      this.entries = { ...archive.entries };
      this.current_dir = archive.current_dir;
      this._ready = archive._ready;
    }
    else {
      this.s_zip = new StreamZip(archive);
      this._ready = new Promise((resolve, reject) => {
        this.s_zip.on('ready', () => {
          const s = this.s_zip;

          // console.log('Entries read: ' + s.entriesCount);
          this.entries = s.entries;

          resolve();
        });
        this.s_zip.on('error', reject);
      });
    }
  }

  dir(dir_name: string) {
    const copy = new StreamArchive(this);

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
    const files: { [name: string]: ZipEntry } = {};
    let current_dir: string = this.current_dir;

    if (!current_dir) {
      current_dir = "";
    }

    for (const key in l) {
      if (key.startsWith(current_dir)) {
        const real_name = key.slice(current_dir.length);

        if (current_dir_only && real_name.match(/\/.+$/)) {
          continue;
        }

        files[real_name] = l[key];
      }
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
    file: ZipEntry, 
    type: "text" 
      | "arraybuffer" 
      | "blob" 
    = "text",
    parse_auto = true
  ) {
    const fp = this.s_zip.entryData(file.name);

    if (parse_auto) {
      return fp.then(data => {
        if (type === "text") {
          let start_pos = 0;
          let length = data.length;
          for (let i = 0; i < length && i < 1024; i++) {
            // Buffer code for "=" character
            if (data[i] === 61) {
              start_pos = i + 1;
              break;
            }
          }

          const buffer_as_text = data.toString('utf-8', start_pos);
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
          return new Blob([ab]);
        }
      }); 
    }
    else {
      return fp;
    }
  }

  async fromFile(name: string | ZipEntry) {
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
      if (!entry.isDirectory) {
        o[name] = entry;
      }
    }

    return o;
  }

  protected get dirs() {
    const o: EntryDict = {};
    for (const [name, entry] of Object.entries(this.entries)) {
      if (entry.isDirectory) {
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

export class Archive implements BaseArchive<JSZip.JSZipObject> {
  protected _ready: Promise<void> = Promise.resolve();
  protected archive: JSZip;
  public events = new EventEmitter;

  constructor(file: AcceptedZipSources) {
    if (file instanceof Archive) {
      this._ready = Promise.resolve();
      this.archive = file.archive;
      return;
    }

    if (file instanceof JSZip) {
      this._ready = Promise.resolve();
      this.archive = file;
      return;
    }

    this._ready = JSZip.loadAsync(file)
      .then(data => {
        this.archive = data;
      });
  }

  ready() {
    return this._ready;
  }

  dir(name: string) {
    return new Archive(this.archive.folder(name));
  }

  has(name: string) {
    return this.search(new RegExp(`^${name}$`)).length > 0;
  }

  get(
    name: string, 
    type: "text" 
      | "arraybuffer" 
      | "blob" 
    = "text",
    parse_auto = true
  ) {
    if (!this.has(name)) {
      // @ts-ignore
      name = this.archive.root + name;
    }

    const f = this.archive.file(name);

    if (!f) {
      this.events.emit('read error', { filename: name });
      throw new FileNotFoundError("File not found: " + name, name);
    }

    return this.read(f, type, parse_auto);
  }

  search(query: RegExp) {
    return this.archive.file(query);
  }

  searchDir(query: RegExp) {
    return this.archive.folder(query);
  }

  read(
    file: JSZip.JSZipObject, 
    type: "text" 
      | "arraybuffer" 
      | "blob" 
    = "text",
    parse_auto = true
  ) {
    const p = file.async(type);

    if (parse_auto) {
      return p.then(data => {
        if (typeof data === 'string') {
          return JSON.parse(data.substr(data.indexOf('=') + 1).trimLeft());
        }
        else {
          return data;
        }
      }); 
    }
    else {
      return p;
    }
  }

  ls(current_dir_only = true) {
    const l = this.archive.files;
    const files: { [name: string]: JSZip.JSZipObject } = {};
    // @ts-ignore
    let current_dir: string = this.archive.root;

    if (!current_dir) {
      current_dir = "";
    }

    for (const key in l) {
      if (key.startsWith(current_dir)) {
        const real_name = key.slice(current_dir.length);

        if (current_dir_only && real_name.match(/\/.+$/)) {
          continue;
        }

        files[real_name] = l[key];
      }
    }

    return files;
  }

  /**
   * Create a new instance of Archive from a file contained in this archive.
   * 
   * @param name File name or file object
   */
  async fromFile(name: string | JSZip.JSZipObject) {
    let f: ArrayBuffer;
    if (typeof name === 'string') {
      f = await this.get(name, "arraybuffer", false);
    }
    else {
      f = await this.read(name, "arraybuffer", false);
    }
    return new Archive(f);
  }

  get raw() {
    return this.archive;
  }
}

export default Archive;
