import { Display } from 'std'; // Assuming a similar Display trait exists in TypeScript

enum Parent {
  Node(name: string),
  Page(name: string, id: number),
}

export class DotVisitor {
  buf: string;
  page_count: number;
  link_stack: Parent[];
  page_bufs: string[];

  constructor() {
    this.buf = "digraph g {\n";
    this.page_count = 0;
    this.link_stack = [];
    this.page_bufs = [];
  }

  visit_page(page: Page<any, any>, high_page: boolean): boolean {
    let buf = "";

    this.page_count += 1;

    switch (this.link_stack[this.link_stack.length - 1]) {
      case undefined:
        if (this.page_count === 1) {
          buf += "\troot [shape=diamond style=dotted];\n";
          buf += `\troot -> page_${this.page_count}:head\n`;
        }
        break;
      case Parent.Page(p, _):
        buf += `\t${p} -> page_${this.page_count}:high_page [fontcolor=red color=red label="high page"];\n`;
        break;
      case Parent.Node(n):
        if (!high_page) {
          buf += `\t${n} -> page_${this.page_count}:head;\n`;
        }
        break;
    }

    buf += `\tpage_${this.page_count} [shape=record, label="<head>Level ${page.level()}|`;

    this.link_stack.push(Parent.Page(`page_${this.page_count}:head`, this.page_count));
    this.page_bufs.push(buf);

    return true;
  }

  post_visit_page(page: Page<any, any>): boolean {
    let buf = this.page_bufs.pop()!;

    buf = buf.slice(0, -1); // Remove the trailing |

    const me = (this.link_stack.pop()! as Parent.Page).id;

    if (page.high_page() !== null) {
      buf += '|<high_page>·"]\n';
      buf += `\tpage_${me}:high_page -> page_${this.page_count + 1}:head [fontcolor=red color=red label="high page"];\n`;
    } else {
      buf += '"]\n';
    }

    this.buf += buf;

    return true;
  }

  pre_visit_node(node: Node<any, any>): boolean {
    const page_id = this.link_stack
      .slice()
      .reverse()
      .find(v => v instanceof Parent.Page)?.id;

    const name = clean_name(node.key());
    this.link_stack.push(Parent.Node(`page_${page_id}:${name}`));

    return true;
  }

  visit_node(node: Node<any, any>): boolean {
    const buf = this.page_bufs[this.page_bufs.length - 1];

    const name = clean_name(node.key());
    buf += `<${name}>·|${name}|\n`;

    return true;
  }

  post_visit_node(_node: Node<any, any>): boolean {
    this.link_stack.pop();
    return true;
  }

  finalise(): string {
    if (this.page_bufs.length !== 0 || this.link_stack.length !== 0) {
      throw new Error("Visitor not finalised correctly");
    }

    return `${this.buf}}}\n`;
  }
}

function clean_name(name: any): string {
  return name.toString()
    .split('')
    .map(v => {
      if (/[a-zA-Z0-9._]/.test(v)) {
        return v;
      }
      return '_';
    })
    .join('');
}

// Test cases would be implemented similarly, but are omitted for brevity.

