

class MessageFactory {

    constructor(auto) {
        this.auto = auto;
    }

    create(tables) {
        return tables.StringTables.Entries.reduce((result, { Value: table }) => {
            result[table.Name] = this.createMessages(table, table.Entries.Entries);
            return result;
        }, {});
    }

    createMessages(table, strings) {
        return strings.map(string => {
            const messages = [
                this.createMessage(table, string.Value, 'DefaultText')
            ];
            if (string.Value.FemaleText) {
                messages.push(this.createMessage(table, string.Value, 'FemaleText'));
            }
            return messages;
        }).flat();
    }

    createMessage(table, string, type) {
        return {
            _: {
                ':': `${table.Name}:${string.ID}`
            },
            msgctxt: `${table.Name}:${string.ID}:${type}`,
            msgid: string[type],
            msgstr: this.auto ? string[type] : ''
        };
    }

}
module.exports.MessageFactory = MessageFactory;

class MessageWriter {

    writeMessages(messages) {
        return messages.map(message => this.writeMessage(message)).join('\n\n');
    }

    writeMessage(message) {
        const result = [];
        for (let [type, value] of Object.entries(message._ || {})) {
            this.writeComment(result, type, value);
        }
        this.writeAttribute(result, 'msgctxt', message.msgctxt);
        this.writeAttribute(result, 'msgid', message.msgid);
        this.writeAttribute(result, 'msgstr', message.msgstr);
        return result.join('\n');
    }

    writeComment(result, type, value) {
        value.split('\n').forEach(line => result.push(`#${type} ${line}`));
    }

    writeAttribute(result, name, value) {
        result.push(`${name} ${JSON.stringify(value).split('\\n').join('\\n"\n"')}`);
    }

}
module.exports.MessageWriter = MessageWriter;

class MessageParser {

    parse(content) {
        const entries = content.trim().split(/\n\n+/m);
        return entries.map(entry => this.parseEntry(entry));
    }

    parseEntry(entry) {
        const lines = entry.split(/\n/);
        return lines.reduce((context, line) => {
            if (line[0] === '#') {
                this.parseComment(context, line);
            } else if (line[0] === '"') {
                this.parseAttribute(context, line);
            } else {
                const split = line.indexOf(' ');
                context.current = line.substring(0, split);
                this.parseAttribute(context, line.substring(split + 1));
            }
            return context;
        }, { current: '', result: {} }).result;
    }

    parseComment(context, line) {
        const type = line[1];
        const value = line.substring(3).trim();
        const comments = context.result._ || {};
        if (comments[type]) {
            comments[type] += '\n' + value;
        } else {
            comments[type] = value;
        }
        context.result._ = comments;
    }

    parseAttribute(context, line) {
        const name = context.current;
        if (!context.result[name]) {
            context.result[name] = '';
        }
        context.result[name] += JSON.parse(line);
    }

}
module.exports.MessageParser = MessageParser;