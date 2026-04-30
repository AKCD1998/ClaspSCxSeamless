var SXLogger = {
  create: function(scope) {
    return {
      scope: scope || SXConfig.APP_KEY,
      entries: []
    };
  },

  info: function(logger, label, value) {
    this.write_(logger, 'INFO', label, value);
  },

  warn: function(logger, label, value) {
    this.write_(logger, 'WARN', label, value);
  },

  error: function(logger, label, value) {
    this.write_(logger, 'ERROR', label, value);
  },

  write_: function(logger, level, label, value) {
    var message = '[' + (logger.scope || SXConfig.APP_KEY) + '] ' + label + ': ' + String(value);
    logger.entries.push({
      level: level,
      label: label,
      value: String(value)
    });

    if (level === 'WARN') {
      console.warn(message);
      return;
    }

    if (level === 'ERROR') {
      console.error(message);
      return;
    }

    console.log(message);
  }
};
