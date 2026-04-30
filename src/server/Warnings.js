var SXWarnings = {
  create: function() {
    return {
      items: []
    };
  },

  add: function(collector, message) {
    if (!collector || !message) {
      return;
    }

    collector.items.push(String(message));
  },

  merge: function(collector, messages) {
    if (!collector || !messages || !messages.length) {
      return;
    }

    for (var index = 0; index < messages.length; index += 1) {
      this.add(collector, messages[index]);
    }
  },

  list: function(collector) {
    if (!collector || !collector.items) {
      return [];
    }

    var seen = {};
    var unique = [];

    for (var index = 0; index < collector.items.length; index += 1) {
      var message = collector.items[index];
      if (!message || seen[message]) {
        continue;
      }

      seen[message] = true;
      unique.push(message);
    }

    return unique;
  }
};
