import zlib from 'zlib';
import events from 'events';
import stream from 'stream';
import fs from 'fs';

export type AcceptedFile = File | string;

function isFile(val: any): val is File {
  return typeof File !== 'undefined' && val instanceof File;
}

export interface FileReader<T, S = T> {
  reader: (file: T, buffer: Buffer, offset_in_buffer: number, length: number, position_in_file: number) => Promise<number> | number;
  opener?: (file: T) => S | Promise<S>;
  getSize: (file: S, original: T) => Promise<number> | number;
  getName: (file: S, original: T) => Promise<string> | string;
};

/**
 * Read a part of a Blob into a Node.js buffer,
 * from position to position+length, into Buffer offset to offset+length
 */
async function blobFileReader(file: Blob, buffer: Buffer, offset_in_buffer: number, length: number, position_in_file: number) {
  const sliced = file.slice(position_in_file, position_in_file + length);

  const copy_buffer = await new Promise((resolve, reject) => {
    const reader = new FileReader;

    reader.onload = () => {
      resolve(Buffer.from(reader.result as ArrayBuffer));
    };

    reader.onerror = (e: any) => {
      reject(e);
    };

    reader.readAsArrayBuffer(sliced);
  }) as Buffer;

  buffer.set(copy_buffer, offset_in_buffer);

  return copy_buffer.byteLength;
}

/**
 * Read a part of a file (via a file descriptor) into a Node.js buffer,
 * from position to position+length, into Buffer offset to offset+length
 */
async function numberFileReader(file: number, buffer: Buffer, offset_in_buffer: number, length: number, position_in_file: number) {
  const bytesRead = await new Promise((resolve, reject) => {
    fs.read(
      file,
      buffer,
      offset_in_buffer,
      length,
      position_in_file,
      (err, bytesRead) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(bytesRead);
      }
    );
  }) as number;

  return bytesRead;
}

/**
 * This code partially belong to node-stream-zip.
 *
 * Code is ported to ES6 + async + TypeScript,
 * and enable Blob use instead of File System I/O operations.
 *
 * @license node-stream-zip | (c) 2015 Antelle | https://github.com/antelle/node-stream-zip/blob/master/LICENSE
 * Portions copyright https://github.com/cthackers/adm-zip | https://raw.githubusercontent.com/cthackers/adm-zip/master/LICENSE
 */

const consts = {
  /* The local file header */
  LOCHDR: 30, // LOC header size
  LOCSIG: 0x04034b50, // "PK\003\004"
  LOCVER: 4, // version needed to extract
  LOCFLG: 6, // general purpose bit flag
  LOCHOW: 8, // compression method
  LOCTIM: 10, // modification time (2 bytes time, 2 bytes date)
  LOCCRC: 14, // uncompressed file crc-32 value
  LOCSIZ: 18, // compressed size
  LOCLEN: 22, // uncompressed size
  LOCNAM: 26, // filename length
  LOCEXT: 28, // extra field length

  /* The Data descriptor */
  EXTSIG: 0x08074b50, // "PK\007\008"
  EXTHDR: 16, // EXT header size
  EXTCRC: 4, // uncompressed file crc-32 value
  EXTSIZ: 8, // compressed size
  EXTLEN: 12, // uncompressed size

  /* The central directory file header */
  CENHDR: 46, // CEN header size
  CENSIG: 0x02014b50, // "PK\001\002"
  CENVEM: 4, // version made by
  CENVER: 6, // version needed to extract
  CENFLG: 8, // encrypt, decrypt flags
  CENHOW: 10, // compression method
  CENTIM: 12, // modification time (2 bytes time, 2 bytes date)
  CENCRC: 16, // uncompressed file crc-32 value
  CENSIZ: 20, // compressed size
  CENLEN: 24, // uncompressed size
  CENNAM: 28, // filename length
  CENEXT: 30, // extra field length
  CENCOM: 32, // file comment length
  CENDSK: 34, // volume number start
  CENATT: 36, // internal file attributes
  CENATX: 38, // external file attributes (host system dependent)
  CENOFF: 42, // LOC header offset

  /* The entries in the end of central directory */
  ENDHDR: 22, // END header size
  ENDSIG: 0x06054b50, // "PK\005\006"
  ENDSIGFIRST: 0x50,
  ENDSUB: 8, // number of entries on this disk
  ENDTOT: 10, // total number of entries
  ENDSIZ: 12, // central directory size in bytes
  ENDOFF: 16, // offset of first CEN header
  ENDCOM: 20, // zip file comment length
  MAXFILECOMMENT: 0xFFFF,

  /* The entries in the end of ZIP64 central directory locator */
  ENDL64HDR: 20, // ZIP64 end of central directory locator header size
  ENDL64SIG: 0x07064b50, // ZIP64 end of central directory locator signature
  ENDL64SIGFIRST: 0x50,
  ENDL64OFS: 8, // ZIP64 end of central directory offset

  /* The entries in the end of ZIP64 central directory */
  END64HDR: 56, // ZIP64 end of central directory header size
  END64SIG: 0x06064b50, // ZIP64 end of central directory signature
  END64SIGFIRST: 0x50,
  END64SUB: 24, // number of entries on this disk
  END64TOT: 32, // total number of entries
  END64SIZ: 40,
  END64OFF: 48,

  /* Compression methods */
  STORED: 0, // no compression
  SHRUNK: 1, // shrunk
  REDUCED1: 2, // reduced with compression factor 1
  REDUCED2: 3, // reduced with compression factor 2
  REDUCED3: 4, // reduced with compression factor 3
  REDUCED4: 5, // reduced with compression factor 4
  IMPLODED: 6, // imploded
  // 7 reserved
  DEFLATED: 8, // deflated
  ENHANCED_DEFLATED: 9, // enhanced deflated
  PKWARE: 10,// PKWare DCL imploded
  // 11 reserved
  BZIP2: 12, //  compressed using BZIP2
  // 13 reserved
  LZMA: 14, // LZMA
  // 15-17 reserved
  IBM_TERSE: 18, // compressed using IBM TERSE
  IBM_LZ77: 19, //IBM LZ77 z

  /* General purpose bit flag */
  FLG_ENC: 0,  // encrypted file
  FLG_COMP1: 1,  // compression option
  FLG_COMP2: 2,  // compression option
  FLG_DESC: 4,  // data descriptor
  FLG_ENH: 8,  // enhanced deflation
  FLG_STR: 16, // strong encryption
  FLG_LNG: 1024, // language encoding
  FLG_MSK: 4096, // mask header values
  FLG_ENTRY_ENC: 1,

  /* 4.5 Extensible data fields */
  EF_ID: 0,
  EF_SIZE: 2,

  /* Header IDs */
  ID_ZIP64: 0x0001,
  ID_AVINFO: 0x0007,
  ID_PFS: 0x0008,
  ID_OS2: 0x0009,
  ID_NTFS: 0x000a,
  ID_OPENVMS: 0x000c,
  ID_UNIX: 0x000d,
  ID_FORK: 0x000e,
  ID_PATCH: 0x000f,
  ID_X509_PKCS7: 0x0014,
  ID_X509_CERTID_F: 0x0015,
  ID_X509_CERTID_C: 0x0016,
  ID_STRONGENC: 0x0017,
  ID_RECORD_MGT: 0x0018,
  ID_X509_PKCS7_RL: 0x0019,
  ID_IBM1: 0x0065,
  ID_IBM2: 0x0066,
  ID_POSZIP: 0x4690,

  EF_ZIP64_OR_32: 0xffffffff,
  EF_ZIP64_OR_16: 0xffff
};

export default class StreamZip<T, S = T> extends events.EventEmitter {
  file: S;
  fileSize: number;
  ready = false;
  fileName: string;
  _entries: { [name: string]: ZipEntry } = {};
  centralDirectory: CentralDirectoryHeader;
  comment: string;
  entriesCount: number;
  op: {
    win?: FileWindowBuffer<S>,
    totalReadLength?: number,
    minPos?: number,
    pos?: number,
    lastPos?: number,
    chunkSize?: number;
    firstByte?: number;
    entriesLeft?: number;
    sig?: number;
    complete?: Function;
    lastBufferPosition?: number
    lastBytesRead?: number;
    entry?: ZipEntry;
    move?: boolean;
  };
  config: {
    entries: boolean;
    skipEntryNameValidation: boolean;
  };

  constructor(
    file: T,
    protected fileReader?: FileReader<T, S>,
    storeEntries = true,
    public chunkSize?: number,
    skip_valid = false
  ) {
    super();

    this.config = {
      entries: storeEntries,
      skipEntryNameValidation: skip_valid
    };

    if (isFile(file)) {
      // @ts-ignore
      this.fileReader = {
        reader: blobFileReader,
        getName: f => f.name,
        getSize: f => f.size
      } as FileReader<File>;
    }
    else if (typeof file === 'string') {
      // @ts-ignore
      this.fileReader = {
        reader: numberFileReader,
        opener: async f => {
          const r = await new Promise((resolve, reject) => {
            fs.open(f, 'r', (err, f) => {
              if (err) {
                reject(err);
                return;
              }

              resolve(f);
            });
          }) as number;

          return r;
        },
        getSize: f => {
          return new Promise((resolve, reject) => {
            fs.fstat(f, (err, stat) => {
              if (err) {
                reject(err);
                return;
              }

              resolve(stat.size);
            });
          }) as Promise<number>;
        },
        getName: (_, original) => original
      } as FileReader<string, number>;
    }
    else if (!fileReader) {
      throw new Error("File format is not supported, you must include a file reader.");
    }

    (async () => {
      if (this.fileReader.opener) {
        this.file = await this.fileReader.opener(file);
      }
      else {
        // Assmuming T = S
        // @ts-ignore
        this.file = file;
      }

      this.fileName = await this.fileReader.getName(this.file, file);
      this.fileSize = await this.fileReader.getSize(this.file, file);

      this.open(chunkSize);
    })().catch(err => {
      this.emit('error', err);
    });
  }

  protected open(chunkSize?: number) {
    this.chunkSize = chunkSize || Math.round(this.fileSize / 1000);
    this.chunkSize = Math.max(Math.min(this.chunkSize, Math.min(128 * 1024, this.fileSize)), Math.min(1024, this.fileSize));
    this.readCentralDirectory();
  }

  protected readCentralDirectory() {
    const totalReadLength = Math.min(consts.ENDHDR + consts.MAXFILECOMMENT, this.fileSize);
    this.op = {
      win: new FileWindowBuffer(this.file, this.fileReader),
      totalReadLength: totalReadLength,
      minPos: this.fileSize - totalReadLength,
      lastPos: this.fileSize,
      chunkSize: Math.min(1024, this.chunkSize),
      firstByte: consts.ENDSIGFIRST,
      sig: consts.ENDSIG,
      complete: this.readCentralDirectoryComplete
    };

    this.op.win.read(this.fileSize - this.op.chunkSize, this.op.chunkSize)
      .then(bytes => this.readUntilFoundCallback(null, bytes))
      .catch(err => this.readUntilFoundCallback(err, 0));
  }

  protected readUntilFoundCallback(err: any, bytesRead: number) {
    if (err || !bytesRead)
      return this.emit('error', err || 'Archive read error');
    var
      buffer = this.op.win.buffer,
      pos = this.op.lastPos,
      bufferPosition = pos - this.op.win.position,
      minPos = this.op.minPos;
    while (--pos >= minPos && --bufferPosition >= 0) {
      if (buffer.length - bufferPosition >= 4 &&
        buffer[bufferPosition] === this.op.firstByte) { // quick check first signature byte
        if (buffer.readUInt32LE(bufferPosition) === this.op.sig) {
          this.op.lastBufferPosition = bufferPosition;
          this.op.lastBytesRead = bytesRead;

          this.op.complete();
          return;
        }
      }
    }
    if (pos === minPos) {
      return this.emit('error', 'Bad archive');
    }
    this.op.lastPos = pos + 1;
    this.op.chunkSize *= 2;
    if (pos <= minPos)
      return this.emit('error', 'Bad archive');

    var expandLength = Math.min(this.op.chunkSize, pos - minPos);
    this.op.win.expandLeft(expandLength)
      .then(bytes => this.readUntilFoundCallback(null, bytes))
      .catch(err => this.readUntilFoundCallback(err, 0));
  }

  readCentralDirectoryComplete = () => {
    var buffer = this.op.win.buffer;
    var pos = this.op.lastBufferPosition;

    try {
      const centralDirectory = new CentralDirectoryHeader();
      centralDirectory.read(buffer.slice(pos, pos + consts.ENDHDR));
      centralDirectory.headerOffset = this.op.win.position + pos;
      if (centralDirectory.commentLength)
        this.comment = buffer.slice(pos + consts.ENDHDR,
          pos + consts.ENDHDR + centralDirectory.commentLength).toString();
      else
        this.comment = null;
      this.entriesCount = centralDirectory.volumeEntries;
      this.centralDirectory = centralDirectory;
      if (
        (centralDirectory.volumeEntries === consts.EF_ZIP64_OR_16 &&
          centralDirectory.totalEntries === consts.EF_ZIP64_OR_16) ||
        centralDirectory.size === consts.EF_ZIP64_OR_32 ||
        centralDirectory.offset === consts.EF_ZIP64_OR_32
      ) {
        return this.readZip64CentralDirectoryLocator();
      } else {
        this.op = {};
        return this.readEntries();
      }
    } catch (err) {
      this.emit('error', err);
    }
  }

  protected readEntries() {
    this.op = {
      win: new FileWindowBuffer(this.file, this.fileReader),
      pos: this.centralDirectory.offset,
      chunkSize: this.chunkSize,
      entriesLeft: this.centralDirectory.volumeEntries
    };

    return this.op.win.read(this.op.pos, Math.min(this.chunkSize, this.fileSize - this.op.pos))
      .then(bytes => this.readEntriesCallback(bytes))
      .catch(err => this.emit('error', err))
  }

  protected readEntriesCallback(bytesRead: number) {
    if (!bytesRead)
      return this.emit('error', 'Entries read error');
    var
      buffer = this.op.win.buffer,
      bufferPos = this.op.pos - this.op.win.position,
      bufferLength = buffer.length,
      entry = this.op.entry;
    try {
      while (this.op.entriesLeft > 0) {
        if (!entry) {
          entry = new ZipEntry();
          entry.readHeader(buffer, bufferPos);
          entry.headerOffset = this.op.win.position + bufferPos;
          this.op.entry = entry;
          this.op.pos += consts.CENHDR;
          bufferPos += consts.CENHDR;
        }
        var entryHeaderSize = entry.fnameLen + entry.extraLen + entry.comLen;
        var advanceBytes = entryHeaderSize + (this.op.entriesLeft > 1 ? consts.CENHDR : 0);
        if (bufferLength - bufferPos < advanceBytes) {
          this.op.win.moveRight(this.chunkSize, bufferPos)
            .then(bytesRead => this.readEntriesCallback(bytesRead));
          this.op.move = true;

          return;
        }
        entry.read(buffer, bufferPos);
        if (!this.config.skipEntryNameValidation) {
          entry.validateName();
        }
        if (this.entries)
          this.entries[entry.name] = entry;
        this.emit('entry', entry);
        this.op.entry = entry = null;
        this.op.entriesLeft--;
        this.op.pos += entryHeaderSize;
        bufferPos += entryHeaderSize;
      }
      this.emit('ready');
    } catch (err) {
      this.emit('error', err);
    }
  }

  protected checkEntriesExist() {
    if (!this._entries)
      throw new Error('storeEntries disabled');
  }

  entry(name: string) {
    this.checkEntriesExist();
    return this.entries[name];
  }

  get entries() {
    this.checkEntriesExist();
    return this._entries;
  }

  readZip64CentralDirectoryLocator() {
    var length = consts.ENDL64HDR;
    if (this.op.lastBufferPosition > length) {
      this.op.lastBufferPosition -= length;
      return this.readZip64CentralDirectoryLocatorComplete();
    } else {
      this.op = {
        win: this.op.win,
        totalReadLength: length,
        minPos: this.op.win.position - length,
        lastPos: this.op.win.position,
        chunkSize: this.op.chunkSize,
        firstByte: consts.ENDL64SIGFIRST,
        sig: consts.ENDL64SIG,
        complete: this.readZip64CentralDirectoryLocatorComplete
      };
      return this.op.win.read(this.op.lastPos - this.op.chunkSize, this.op.chunkSize)
        .then(bytes => this.readUntilFoundCallback(null, bytes))
        .catch(err => this.readUntilFoundCallback(err, 0));
    }
  }

  readZip64CentralDirectoryLocatorComplete = () => {
    var buffer = this.op.win.buffer;
    var locHeader = new CentralDirectoryLoc64Header();
    locHeader.read(buffer.slice(this.op.lastBufferPosition, this.op.lastBufferPosition + consts.ENDL64HDR));
    var readLength = this.fileSize - locHeader.headerOffset;
    this.op = {
      win: this.op.win,
      totalReadLength: readLength,
      minPos: locHeader.headerOffset,
      lastPos: this.op.lastPos,
      chunkSize: this.op.chunkSize,
      firstByte: consts.END64SIGFIRST,
      sig: consts.END64SIG,
      complete: this.readZip64CentralDirectoryComplete
    };
    return this.op.win.read(this.fileSize - this.op.chunkSize, this.op.chunkSize)
      .then(bytes => this.readUntilFoundCallback(null, bytes))
      .catch(err => this.readUntilFoundCallback(err, 0))
  }

  readZip64CentralDirectoryComplete = () => {
    var buffer = this.op.win.buffer;
    var zip64cd = new CentralDirectoryZip64Header();
    zip64cd.read(buffer.slice(this.op.lastBufferPosition, this.op.lastBufferPosition + consts.END64HDR));
    this.centralDirectory.volumeEntries = zip64cd.volumeEntries;
    this.centralDirectory.totalEntries = zip64cd.totalEntries;
    this.centralDirectory.size = zip64cd.size;
    this.centralDirectory.offset = zip64cd.offset;
    this.entriesCount = zip64cd.volumeEntries;
    this.op = {};
    this.readEntries();
  }

  dataOffset(entry: ZipEntry) {
    return entry.offset + consts.LOCHDR + entry.fnameLen + entry.extraLen;
  }

  canVerifyCrc(entry: ZipEntry) {
    // if bit 3 (0x08) of the general-purpose flags field is set, then the CRC-32 and file sizes are not known when the header is written
    return (entry.flags & 0x8) !== 0x8;
  }

  stream(entry: ZipEntry) {
    return this.openEntry(entry)
      .then(([_, entry]) => {
        var offset = this.dataOffset(entry);
        var entryStream = new EntryDataReaderStream(this.file, offset, entry.compressedSize, this.fileReader);
        if (entry.method === consts.STORED) {
        } else if (entry.method === consts.DEFLATED || entry.method === consts.ENHANCED_DEFLATED) {
          // @ts-ignore
          entryStream = entryStream.pipe(zlib.createInflateRaw());
        } else {
          throw new Error('Unknown compression method: ' + entry.method);
        }
        if (this.canVerifyCrc(entry))
          // @ts-ignore
          entryStream = entryStream.pipe(new EntryVerifyStream(entryStream, entry.crc, entry.size));
        return entryStream;
      });
  }

  async openEntry(entry: ZipEntry | string) {
    if (typeof entry === 'string') {
      this.checkEntriesExist();
      entry = this.entries[entry];
      if (!entry)
        throw new Error('Entry not found');
    }
    if (!entry.isFile)
      throw new Error('Entry is not file');
    if (!this.file)
      throw new Error('Archive closed');

    var buffer = Buffer.alloc(consts.LOCHDR);
    await new FsRead(
      this.file,
      buffer,
      0,
      buffer.length,
      entry.offset,
      this.fileReader
    ).read();

    var readEx;
    try {
      entry.readDataHeader(buffer);
      if (entry.encrypted) {
        readEx = 'Entry encrypted';
      }
    } catch (ex) {
      readEx = ex;
    }

    return [readEx, entry] as [any, ZipEntry];
  }

  close() {
    this.file = null;
  }

  async entryData(entry: ZipEntry | string) {
    var err = null;
    [err, entry] = await this.openEntry(entry);
    if (err)
      throw err;

    var data = Buffer.alloc(entry.compressedSize);

    await new FsRead(
      this.file,
      data,
      0,
      entry.compressedSize,
      this.dataOffset(entry),
      this.fileReader
    ).read();

    if (entry.method === consts.STORED) { }
    else if (entry.method === consts.DEFLATED || entry.method === consts.ENHANCED_DEFLATED) {
      data = zlib.inflateRawSync(data);
    }
    else {
      throw new Error('Unknown compression method: ' + entry.method);
    }
    if (data.length !== entry.size)
      throw new Error('Invalid size');
    if (this.canVerifyCrc(entry)) {
      var verify = new CrcVerify(entry.crc, entry.size);
      verify.data(data);
    }
    return data;
  }
}

class CentralDirectoryHeader {
  volumeEntries: number;
  totalEntries: number;
  size: number;
  offset: number;
  commentLength: number;
  headerOffset: number;

  read(data: Buffer) {
    if (data.length !== consts.ENDHDR || data.readUInt32LE(0) !== consts.ENDSIG)
      throw new Error('Invalid central directory');
    // number of entries on this volume
    this.volumeEntries = data.readUInt16LE(consts.ENDSUB);
    // total number of entries
    this.totalEntries = data.readUInt16LE(consts.ENDTOT);
    // central directory size in bytes
    this.size = data.readUInt32LE(consts.ENDSIZ);
    // offset of first CEN header
    this.offset = data.readUInt32LE(consts.ENDOFF);
    // zip file comment length
    this.commentLength = data.readUInt16LE(consts.ENDCOM);
  }
}

class CentralDirectoryLoc64Header {
  headerOffset: number;

  read(data: Buffer) {
    if (data.length !== consts.ENDL64HDR || data.readUInt32LE(0) !== consts.ENDL64SIG)
      throw new Error('Invalid zip64 central directory locator');
    // ZIP64 EOCD header offset
    this.headerOffset = Util.readUInt64LE(data, consts.ENDSUB);
  }
}

class CentralDirectoryZip64Header {
  volumeEntries: number;
  totalEntries: number;
  size: number;
  offset: number;

  read(data: Buffer) {
    if (data.length !== consts.END64HDR || data.readUInt32LE(0) !== consts.END64SIG)
      throw new Error('Invalid central directory');
    // number of entries on this volume
    this.volumeEntries = Util.readUInt64LE(data, consts.END64SUB);
    // total number of entries
    this.totalEntries = Util.readUInt64LE(data, consts.END64TOT);
    // central directory size in bytes
    this.size = Util.readUInt64LE(data, consts.END64SIZ);
    // offset of first CEN header
    this.offset = Util.readUInt64LE(data, consts.END64OFF);
  }
}

export class ZipEntry {
  verMade: number;
  version: number;
  flags: number;
  method: number;
  time: number;
  crc: number;
  compressedSize: number;
  size: number;
  fnameLen: number;
  extraLen: number;
  comLen: number;
  diskStart: number;
  inattr: number;
  attr: number;
  offset: number;
  name: string;
  isDirectory: boolean;
  comment: string;
  headerOffset: number;

  readHeader(data: Buffer, offset: number) {
    // data should be 46 bytes and start with "PK 01 02"
    if (data.length < offset + consts.CENHDR || data.readUInt32LE(offset) !== consts.CENSIG) {
      throw new Error('Invalid entry header');
    }
    // version made by
    this.verMade = data.readUInt16LE(offset + consts.CENVEM);
    // version needed to extract
    this.version = data.readUInt16LE(offset + consts.CENVER);
    // encrypt, decrypt flags
    this.flags = data.readUInt16LE(offset + consts.CENFLG);
    // compression method
    this.method = data.readUInt16LE(offset + consts.CENHOW);
    // modification time (2 bytes time, 2 bytes date)
    var timebytes = data.readUInt16LE(offset + consts.CENTIM);
    var datebytes = data.readUInt16LE(offset + consts.CENTIM + 2);
    this.time = parseZipTime(timebytes, datebytes);

    // uncompressed file crc-32 value
    this.crc = data.readUInt32LE(offset + consts.CENCRC);
    // compressed size
    this.compressedSize = data.readUInt32LE(offset + consts.CENSIZ);
    // uncompressed size
    this.size = data.readUInt32LE(offset + consts.CENLEN);
    // filename length
    this.fnameLen = data.readUInt16LE(offset + consts.CENNAM);
    // extra field length
    this.extraLen = data.readUInt16LE(offset + consts.CENEXT);
    // file comment length
    this.comLen = data.readUInt16LE(offset + consts.CENCOM);
    // volume number start
    this.diskStart = data.readUInt16LE(offset + consts.CENDSK);
    // internal file attributes
    this.inattr = data.readUInt16LE(offset + consts.CENATT);
    // external file attributes
    this.attr = data.readUInt32LE(offset + consts.CENATX);
    // LOC header offset
    this.offset = data.readUInt32LE(offset + consts.CENOFF);
  }

  readDataHeader(data: Buffer) {
    // 30 bytes and should start with "PK\003\004"
    if (data.readUInt32LE(0) !== consts.LOCSIG) {
      throw new Error('Invalid local header');
    }
    // version needed to extract
    this.version = data.readUInt16LE(consts.LOCVER);
    // general purpose bit flag
    this.flags = data.readUInt16LE(consts.LOCFLG);
    // compression method
    this.method = data.readUInt16LE(consts.LOCHOW);
    // modification time (2 bytes time ; 2 bytes date)
    var timebytes = data.readUInt16LE(consts.LOCTIM);
    var datebytes = data.readUInt16LE(consts.LOCTIM + 2);
    this.time = parseZipTime(timebytes, datebytes);

    // uncompressed file crc-32 value
    this.crc = data.readUInt32LE(consts.LOCCRC) || this.crc;
    // compressed size
    var compressedSize = data.readUInt32LE(consts.LOCSIZ);
    if (compressedSize && compressedSize !== consts.EF_ZIP64_OR_32) {
      this.compressedSize = compressedSize;
    }
    // uncompressed size
    var size = data.readUInt32LE(consts.LOCLEN);
    if (size && size !== consts.EF_ZIP64_OR_32) {
      this.size = size;
    }
    // filename length
    this.fnameLen = data.readUInt16LE(consts.LOCNAM);
    // extra field length
    this.extraLen = data.readUInt16LE(consts.LOCEXT);
  }

  read(data: Buffer, offset: number) {
    this.name = data.slice(offset, offset += this.fnameLen).toString();
    var lastChar = data[offset - 1];
    this.isDirectory = (lastChar === 47) || (lastChar === 92);

    if (this.extraLen) {
      this.readExtra(data, offset);
      offset += this.extraLen;
    }
    this.comment = this.comLen ? data.slice(offset, offset + this.comLen).toString() : null;
  }

  readExtra(data: Buffer, offset: number) {
    var signature, size, maxPos = offset + this.extraLen;
    while (offset < maxPos) {
      signature = data.readUInt16LE(offset);
      offset += 2;
      size = data.readUInt16LE(offset);
      offset += 2;
      if (consts.ID_ZIP64 === signature) {
        this.parseZip64Extra(data, offset, size);
      }
      offset += size;
    }
  }

  validateName() {
    if (/\\|^\w+:|^\/|(^|\/)\.\.(\/|$)/.test(this.name)) {
      throw new Error('Malicious entry: ' + this.name);
    }
  }

  parseZip64Extra(data: Buffer, offset: number, length: number) {
    if (length >= 8 && this.size === consts.EF_ZIP64_OR_32) {
      this.size = Util.readUInt64LE(data, offset);
      offset += 8; length -= 8;
    }
    if (length >= 8 && this.compressedSize === consts.EF_ZIP64_OR_32) {
      this.compressedSize = Util.readUInt64LE(data, offset);
      offset += 8; length -= 8;
    }
    if (length >= 8 && this.offset === consts.EF_ZIP64_OR_32) {
      this.offset = Util.readUInt64LE(data, offset);
      offset += 8; length -= 8;
    }
    if (length >= 4 && this.diskStart === consts.EF_ZIP64_OR_16) {
      this.diskStart = data.readUInt32LE(offset);
      // offset += 4; length -= 4;
    }
  }

  get encrypted() {
    return (this.flags & consts.FLG_ENTRY_ENC) === consts.FLG_ENTRY_ENC;
  }

  get isFile() {
    return !this.isDirectory;
  }
}

function toBits(dec: number, size: number) {
  let b = (dec >>> 0).toString(2);
  while (b.length < size)
    b = '0' + b;
  return b.split('');
}

function parseZipTime(timebytes: number, datebytes: number) {
  const timebits = toBits(timebytes, 16);
  const datebits = toBits(datebytes, 16);

  const mt = {
    h: parseInt(timebits.slice(0, 5).join(''), 2),
    m: parseInt(timebits.slice(5, 11).join(''), 2),
    s: parseInt(timebits.slice(11, 16).join(''), 2) * 2,
    Y: parseInt(datebits.slice(0, 7).join(''), 2) + 1980,
    M: parseInt(datebits.slice(7, 11).join(''), 2),
    D: parseInt(datebits.slice(11, 16).join(''), 2),
  };
  const dt_str = [mt.Y, mt.M, mt.D].join('-') + ' ' + [mt.h, mt.m, mt.s].join(':') + ' GMT+0';
  return new Date(dt_str).getTime();
}

class FsRead<S> {
  bytesRead = 0;
  waiting = false;

  constructor(
    public file: S,
    public buffer: Buffer,
    public offset: number,
    public length: number,
    public position: number,
    public fileReader: FileReader<any, S>,
  ) { }

  async read() {
    this.waiting = true;

    const readed = await this.fileReader.reader(
      this.file,
      this.buffer,
      this.offset + this.bytesRead,
      this.length - this.bytesRead,
      this.position + this.bytesRead
    );

    return this.readCallback(readed);
  }

  readCallback(bytesRead: number): Promise<number> {
    if (typeof bytesRead === 'number')
      this.bytesRead += bytesRead;
    if (!bytesRead || this.bytesRead === this.length) {
      this.waiting = false;
      return Promise.resolve(this.bytesRead);
    } else {
      return this.read();
    }
  }
}

class FileWindowBuffer<S> {
  position: number;
  buffer: Buffer = Buffer.alloc(0);
  fsOp: FsRead<S> = null;

  constructor(public file: S, public fileReader: FileReader<any, S>) { }

  checkOp() {
    if (this.fsOp && this.fsOp.waiting) {
      throw new Error('Operation in progress');
    }
  }

  async read(pos: number, length: number) {
    this.checkOp();
    if (this.buffer.length < length)
      this.buffer = Buffer.alloc(length);
    this.position = pos;
    this.fsOp = new FsRead(this.file, this.buffer, 0, length, this.position, this.fileReader);

    return await this.fsOp.read();
  }

  async expandLeft(length: number) {
    this.checkOp();
    this.buffer = Buffer.concat([Buffer.alloc(length), this.buffer]);
    this.position -= length;
    if (this.position < 0)
      this.position = 0;
    this.fsOp = new FsRead(this.file, this.buffer, 0, length, this.position, this.fileReader);

    return await this.fsOp.read();
  }

  async expandRight(length: number) {
    this.checkOp();
    var offset = this.buffer.length;
    this.buffer = Buffer.concat([this.buffer, Buffer.alloc(length)]);
    this.fsOp = new FsRead(
      this.file,
      this.buffer,
      offset,
      length,
      this.position + offset,
      this.fileReader
    );

    return await this.fsOp.read();
  }

  async moveRight(_: number, shift: number) {
    this.checkOp();
    if (shift) {
      this.buffer.copy(this.buffer, 0, shift);
    } else {
      shift = 0;
    }
    this.position += shift;
    this.fsOp = new FsRead(
      this.file,
      this.buffer,
      this.buffer.length - shift,
      shift,
      this.position + this.buffer.length - shift,
      this.fileReader
    );

    return await this.fsOp.read();
  }
}

class EntryDataReaderStream<S> extends stream.Readable {
  pos: number = 0;

  constructor(public file: S, public offset: number, public length: number, public fileReader: FileReader<any, S>) {
    super();
  }

  _read(n: number) {
    var buffer = Buffer.alloc(Math.min(n, this.length - this.pos));
    if (buffer.length) {
      const prom = this.fileReader.reader(
        this.file,
        buffer,
        0,
        buffer.length,
        this.offset + this.pos
      );

      if (prom instanceof Promise) {
        prom.then(read => this.readCallback(read, buffer));
      }
      else {
        this.readCallback(prom, buffer)
      }
    } else {
      this.push(null);
    }
  }

  readCallback(bytesRead: number, buffer: Buffer) {
    this.pos += bytesRead;
    if (!bytesRead) {
      this.push(null);
    } else {
      if (bytesRead !== buffer.length)
        buffer = buffer.slice(0, bytesRead);
      this.push(buffer);
    }
  }
}

class EntryVerifyStream<S> extends stream.Transform {
  verify: CrcVerify;

  constructor(baseStm: EntryDataReaderStream<S>, crc: number, size: number) {
    super();

    this.verify = new CrcVerify(crc, size);
    baseStm.on('error', (e) => {
      this.emit('error', e);
    });
  }

  _transform(data: Buffer, _: string, callback: Function) {
    var err;
    try {
      this.verify.data(data);
    } catch (e) {
      err = e;
    }
    callback(err, data);
  }
}

class CrcVerify {
  state = {
    crc: ~0,
    size: 0
  };

  static crcTable: any[];

  constructor(public crc: number, public size: number) { }

  data(data: Buffer) {
    var crcTable = CrcVerify.getCrcTable();
    var crc = this.state.crc, off = 0, len = data.length;
    while (--len >= 0)
      crc = crcTable[(crc ^ data[off++]) & 0xff] ^ (crc >>> 8);
    this.state.crc = crc;
    this.state.size += data.length;
    if (this.state.size >= this.size) {
      var buf = Buffer.alloc(4);
      buf.writeInt32LE(~this.state.crc & 0xffffffff, 0);
      crc = buf.readUInt32LE(0);
      if (crc !== this.crc)
        throw new Error('Invalid CRC');
      if (this.state.size !== this.size)
        throw new Error('Invalid size');
    }
  }

  static getCrcTable() {
    var crcTable = CrcVerify.crcTable;
    if (!crcTable) {
      CrcVerify.crcTable = crcTable = [];
      var b = Buffer.alloc(4);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 8; --k >= 0;)
          if ((c & 1) !== 0) { c = 0xedb88320 ^ (c >>> 1); } else { c = c >>> 1; }
        if (c < 0) {
          b.writeInt32LE(c, 0);
          c = b.readUInt32LE(0);
        }
        crcTable[n] = c;
      }
    }
    return crcTable;
  }
}

const Util = {
  readUInt64LE: function (buffer: Buffer, offset: number) {
    return (buffer.readUInt32LE(offset + 4) * 0x0000000100000000) + buffer.readUInt32LE(offset);
  }
};
