import { BaseArchive } from "./StreamArchive";
import { ScreenNameChange, GPDRProtectedHistory, InnerGDPRPersonalization, InnerGDPRAgeInfo, GDPRAgeInfo, GPDRScreenNameHistory, UserFullAgeInfo, ConnectedApplication, UserEmailAddressChange, IpAudit, PushDevice, MessagingDevice, UserPersonalization } from "./TwitterTypes";
import TweetArchive from "./TweetArchive";
import { parseTwitterDate } from "./Archive";

export class CollectedUserData {
  protected archive: BaseArchive<any>;

  protected _sn_history: ScreenNameChange[] = [];
  protected _lock_history: GPDRProtectedHistory[] = [];
  protected _age: UserFullAgeInfo;
  protected _creation_ip: string;
  protected _timezone: string;
  protected _apps: ConnectedApplication[] = [];
  protected _email_addresses: UserEmailAddressChange[] = [];
  protected _login_ips: IpAudit[] = [];
  protected _registred_devices: {
    push_devices: PushDevice[],
    messaging_devices: MessagingDevice[]
  } = {
    push_devices: [],
    messaging_devices: []
  };
  protected _verified = false;
  protected _phone_nb: string | undefined;
  protected _p13n: UserPersonalization;

  
  async init(archive: BaseArchive<any>) {
    this.archive = archive;

    await Promise.all([
      this.initAgeInfo(),
      this.initScreenNameHistory(),
      this.initProtectedHistory(),
      this.initCreationIp(),
      this.initTimezone(),
      this.initConnectedApps(),
      this.initEmailAddresses(),
      this.initIpAudit(),
      this.initNiDevices(),
      this.initVerified(),
      this.initPhoneNumber(),
    ]);

    // Needs that age info be initialized
    await this.initPersonalization();
  
    this.archive = undefined;
  }


  /** -------------- */
  /** INIT FUNCTIONS */
  /** -------------- */

  protected async initPersonalization() {
    try {
      const p13n: InnerGDPRPersonalization = (await this.archive.get('personalization.js'))[0].p13nData;

      const languages = new Set<string>();
      let gender = "";
      const interests_names = new Set<string>();
      let advertisers = new Set<string>();
      let shows = new Set<string>();

      if (p13n.demographics) {
        if (p13n.demographics.languages) {
          for (const lang of p13n.demographics.languages) {
            languages.add(lang.language);
          }
        }
        if (p13n.demographics.genderInfo) {
          gender = p13n.demographics.genderInfo.gender;
        }
      }
      if (p13n.interests) {
        if (p13n.interests.interests) {
          for (const interest of p13n.interests.interests) {
            interests_names.add(interest.name);
          }
        }
        if (p13n.interests.audienceAndAdvertisers) {
          if (p13n.interests.audienceAndAdvertisers.advertisers) {
            advertisers = new Set(p13n.interests.audienceAndAdvertisers.advertisers);
          }
        }
        if (p13n.interests.shows) {
          shows = new Set(p13n.interests.shows);
        }
      }
      if (p13n.inferredAgeInfo && this._age) {
        this._age.inferred = {
          age: CollectedUserData.parseAge(p13n.inferredAgeInfo.age),
          birthDate: p13n.inferredAgeInfo.birthDate
        };
      }

      this._p13n = {
        demographics: {
          languages: [...languages],
          gender
        },
        interests: {
          names: [...interests_names],
          advertisers: [...advertisers],
          partnerInterests: p13n.interests ? p13n.interests.partnerInterests : [],
          shows: [...shows]
        }
      };
    } catch (e) { }
  }

  protected async initAgeInfo() {
    try {
      const age_meta = (await this.archive.get('ageinfo.js') as GDPRAgeInfo)[0].ageMeta;

      this._age = {
        age: CollectedUserData.parseAge(age_meta.ageInfo.age),
        birthDate: age_meta.ageInfo.birthDate,
      };

      if (age_meta.inferredAgeInfo) {
        this._age.inferred = {
          age: CollectedUserData.parseAge(age_meta.inferredAgeInfo.age),
          birthDate: age_meta.inferredAgeInfo.birthDate
        };
      }
    } catch (e) { }
  }

  protected async initScreenNameHistory() {
    try {
      const f_history = await this.archive.get('screen-name-change.js') as { screenNameChange: GPDRScreenNameHistory }[];
      for (const e of f_history) {
        this._sn_history.push(e.screenNameChange.screenNameChange);
      }
    } catch (e) { }
  }

  protected async initProtectedHistory() {
    try {
      const f_phistory = await this.archive.get('protected-history.js') as { protectedHistory: GPDRProtectedHistory }[];
      for (const e of f_phistory) {
        this._lock_history.push(e.protectedHistory);
      }
    } catch (e) { }
  }

  protected async initCreationIp() {
    try {
      this._creation_ip = (await this.archive.get('account-creation-ip.js'))[0].accountCreationIp.userCreationIp;
    } catch (e) { }
  }

  protected async initTimezone() {
    try {
      this._timezone = (await this.archive.get('account-timezone.js'))[0].accountTimezone.timeZone;
    } catch (e) { }
  }

  protected async initConnectedApps() {
    try {
      const apps = (await this.archive.get('connected-application.js'));

      for (let app of apps) {
        app = app.connectedApplication;

        let d: Date;
        if (app.approvedAt) {
          d = TweetArchive.parseTwitterDate(app.approvedAt);
        }
        else { // Old RGPD archives have approvedAtMsec, with stringified timestamp
          d = new Date(Number(app.approvedAtMsec));
        }

        this._apps.push({
          ...app,
          approvedAt: d
        });
      }
    } catch (e) { }
  }

  protected async initEmailAddresses() {
    try {
      const mails = (await this.archive.get('email-address-change.js'));

      for (let mail of mails) {
        mail = mail.emailAddressChange.emailChange;

        this._email_addresses.push({
          changedAt: parseTwitterDate(mail.changedAt),
          changedFrom: mail.changedFrom,
          changedTo: mail.changedTo
        });
      }
    } catch (e) { }
  }

  protected async initIpAudit() {
    try {
      const ips = (await this.archive.get('ip-audit.js'));

      for (let ip of ips) {
        ip = ip.ipAudit;

        this._login_ips.push({
          createdAt: parseTwitterDate(ip.createdAt),
          loginIp: ip.loginIp
        });
      }
    } catch (e) { }
  }

  protected async initNiDevices() {
    try {
      const nidev = (await this.archive.get('ni-devices.js'));

      for (let device of nidev) {
        device = device.niDeviceResponse;

        if (device.pushDevice) {
          this._registred_devices.push_devices.push(device.pushDevice);
        }
        else if (device.messagingDevice) {
          this._registred_devices.messaging_devices.push(device.messagingDevice);
        }
      }
    } catch (e) { }
  }

  protected async initVerified() {
    try {
      this._verified = (await this.archive.get('verified.js'))[0].verified.verified;
    } catch (e) { }
  }

  protected async initPhoneNumber() {
    try {
      // Could be undefined; will throw and be catched in that case, phone_nb remains untouched
      this._phone_nb = (await this.archive.get('phone-number.js'))[0].device.phoneNumber;
    } catch (e) { }
  }


  /** ------ */
  /** LOADER */
  /** -----  */

  /**
   * Load a part of CollectedUserData archive.
   * 
   * Should be used to build from hand this object.
   */
  loadPart({
    phone_number, 
    verified, 
    personalization, 
    protected_history, 
    screen_name_history, 
    age_info, 
    email_address_changes, 
    login_ips, 
    timezone, 
    applications
  }: {
    phone_number?: string;
    verified?: boolean;
    personalization?: UserPersonalization,
    screen_name_history?: ScreenNameChange[],
    protected_history?: GPDRProtectedHistory[],
    age_info?: UserFullAgeInfo;
    timezone?: string;
    applications?: ConnectedApplication[],
    email_address_changes?: UserEmailAddressChange[],
    login_ips?: IpAudit[]
  } = {}) {
    if (phone_number) {
      this._phone_nb = phone_number;
    }
    if (verified !== undefined) {
      this._verified = verified;
    }
    if (personalization) {
      this._p13n = personalization;
    }
    if (protected_history) {
      this._lock_history = protected_history;
    }
    if (screen_name_history) {
      this._sn_history = screen_name_history;
    }
    if (age_info) {
      this._age = age_info;
    }
    if (email_address_changes) {
      this._email_addresses = email_address_changes;
    }
    if (login_ips) {
      this._login_ips = login_ips;
    }
    if (timezone) {
      this._timezone = timezone;
    }
    if (applications) {
      this._apps = applications;
    }
  }


  /** --------- */
  /** ACCESSORS */
  /** --------- */

  /** History of screen names used, and when it has changed. */
  get screen_name_history() {
    return this._sn_history;
  }

  /** History of changed made to protection on account (lock). */
  get protected_history() {
    return this._lock_history;
  }

  /** History of e-mail addresses used on the account. */
  get email_address_history() {
    return this._email_addresses;
  }

  /** "Guessed" things by Twitter about archive owner.
   * 
   * ```ts
   * const p13n = archive.collected.personalization;
   * // "Speaked" languages (this is VERY approximative)
   * p13n.demographics.languages // => string[]
   * // Archive owner assigned gender
   * p13n.demographics.gender // => string
   * // Subjects of interest
   * p13n.interests.names // => string[]
   * // Shows that owner might watched
   * p13n.interests.shows // => string[]
   * ```
   */
  get personalization() {
    return this._p13n;
  }

  /** Age information from Twitter.
   * If Twitter has tried to guess your age, it is in `age.inferred`.
   * 
   * Age information can be number or a tuple of 2 numbers,
   * Twitter can sometimes guess a interval of your age (like 13-54).
   */
  get age() {
    return this._age;
  }

  /** Owner IP address when he created his account. */
  get account_creation_ip() {
    return this._creation_ip;
  }

  /** Timezone, but in a strange format. 
   * If your timezone is `Europe/Paris`, here, you will find `Paris`.
   */
  get timezone() {
    return this._timezone;
  }

  /** A list of accepted OAuth application on owner's account.
   * 
   * This might be incomplete compared to reality, Twitter doesn't seem to include every application.
   */
  get authorized_applications() {
    return this._apps;
  }

  /** Contains IP dumps of your last activity on Twitter (using mobile or desktop devices).
   *  
   * Seems limited up to 7 days from archive creation.
   */
  get last_logins() {
    return this._login_ips;
  }

  /** Registred mobile devices that get push notifications, or registred to Twitter's 2FA. */
  get devices() {
    return this._registred_devices;
  }

  /** `true` if archive owner is verified on Twitter. */
  get verified() {
    return this._verified;
  }

  /** Archive owner phone number (if he registred one), `undefined` otherwise.
   * Begin by `+<countryCode>`
   */
  get phone_number() {
    return this._phone_nb;
  }

  /** Current owner email address. */
  get email_address() {
    let last_address: string = undefined;
    let max_date: Date = undefined;

    for (const a of this.email_address_history) {
      if (!max_date || max_date.getTime() < a.changedAt.getTime()) {
        last_address = a.changedTo;
        max_date = a.changedAt;
      }
    }

    return last_address;
  }
  

  /** ------- */
  /** HELPERS */
  /** ------- */

  protected static parseAge(age: string[]) : number | [number, number] {
    const a = age[0];
    if (age) {
      const splitted = a.split('-');
      if (splitted.length > 1) {
        return [Number(splitted[0]), Number(splitted[1])];
      }
      return Number(age[0]);
    }
    return 20;
  }
}

export default CollectedUserData;
