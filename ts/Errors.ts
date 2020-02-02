
/**
 * Thrown when a file has an incorrect JSON syntax. Contains filename and file content.
 */
export class FileParseError extends SyntaxError {
  constructor(message: string, public filename: string, public content: string) {
    super(message);

    // Maintenir dans la pile une trace adéquate de l'endroit où l'erreur a été déclenchée (disponible seulement en V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileParseError);
    }
    this.name = 'FileParseError';
  }
}

/**
 * Thrown when tweet file is incorrect. Property `extract` contain one tweet.
 */
export class TweetFileError extends TypeError {
  constructor(message: string, public extract: any, public original_stack?: string) {
    super(message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TweetFileError);
    }
    this.name = 'TweetFileError';
  }
}

/**
 * Thrown when DM file is incorrect. Property `extract` contain one dm.
 */
export class DirectMessageParseError extends TypeError {
  constructor(message: string, public extract: any, public original_stack?: string) {
    super(message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DirectMessageParseError);
    }
    this.name = 'DirectMessageParseError';
  }
}

/**
 * Thrown when Profile file is incorrect. Property `extract` contain the profile.
 */
export class ProfileFileError extends TypeError {
  constructor(message: string, public extract: any, public original_stack?: string) {
    super(message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProfileFileError);
    }
    this.name = 'ProfileFileError';
  }
}

/**
 * Thrown when Account file is incorrect. Property `extract` contain the profile.
 */
export class AccountFileError extends TypeError {
  constructor(message: string, public extract: any, public original_stack?: string) {
    super(message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AccountFileError);
    }
    this.name = 'AccountFileError';
  }
}
