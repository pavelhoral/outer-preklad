

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
            msgstr: this.auto ? string[type] : ""
        };
    }

}
module.exports.MessageFactory = MessageFactory;

class MessageWriter {

    writeMessages(messages) {
        return messages.map(message => this.writeMessage(message)).join("\n\n");
    }

    writeMessage(message) {
        const result = [];
        for (let [type, value] of Object.entries(message._ || {})) {
            this.writeComment(result, type, value);
        }
        this.writeAttribute(result, 'msgctxt', message.msgctxt);
        this.writeAttribute(result, 'msgid', message.msgid);
        this.writeAttribute(result, 'msgstr', message.msgstr);
        return result.join("\n");
    }

    writeComment(result, type, value) {
        value.split("\n").forEach(line => result.push(`#${type} ${line}`));
    }

    writeAttribute(result, name, value) {
        result.push(`${name} ${JSON.stringify(value).split("\\n").join("\\n\"\n\"")}`);
    }

}
module.exports.MessageWriter = MessageWriter;
