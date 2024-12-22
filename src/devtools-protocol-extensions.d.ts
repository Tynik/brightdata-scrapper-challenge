import 'devtools-protocol';

declare module 'devtools-protocol' {
  namespace ProtocolMapping {
    interface Commands {
      'Page.inspect': {
        paramsType: [{ frameId: string }];
        returnType: { url: string };
      };
    }
  }
}
