import { playMenu } from './play.page';
import { itemNeedsServer } from './hub-menu.component';

describe('playMenu', () => {
  it('with the server: Modo solo and the Sala de pruebas of the server', () => {
    expect(playMenu({ cutOff: false, offline: false }).map((i) => i.id)).toEqual(['online', 'bot', 'tests', 'tutorial']);
  });

  it('without the connection: both solo modes in this browser, Online left out, the tutorial kept', () => {
    expect(playMenu({ cutOff: true, offline: true }).map((i) => i.id)).toEqual(['offline', 'tests-offline', 'tutorial']);
  });

  it('the installed app not connected: both solo modes in this browser, Online marked (opening it connects)', () => {
    const menu = playMenu({ cutOff: false, offline: false, local: true });
    expect(menu.map((i) => i.id)).toEqual(['online', 'offline', 'tests-offline', 'tutorial']);
    expect(menu.filter(itemNeedsServer).map((i) => i.id)).toEqual(['online']);
  });

  it('the server not answering (but a connection): both solo modes in this browser, Online still tried', () => {
    expect(playMenu({ cutOff: true, offline: false }).map((i) => i.id)).toEqual(['online', 'offline', 'tests-offline', 'tutorial']);
  });
});
