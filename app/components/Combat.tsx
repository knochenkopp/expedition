import * as React from 'react'

import Button from './base/Button'
import Card from './base/Card'
import Picker from './base/Picker'
import TimerCard from './base/TimerCard'
import theme from '../theme'
import {capitalizeFirstLetter, numberToWord, MAX_ADVENTURER_HEALTH, REGEX} from '../constants'
import {getEventParameters} from '../parser/Handlers'
import {encounters} from '../Encounters'
import {isSurgeRound} from '../reducers/combat'
import {XMLElement, SettingsType, CardState, CardName} from '../reducers/StateTypes'
import {ParserNode} from '../parser/Node'
import {CombatState, CombatPhaseNameType, MidCombatPhase, EndCombatPhase, EventParameters, Enemy, Loot, QuestContext} from '../reducers/QuestTypes'


export interface CombatStateProps {
  card: CardState;
  node?: XMLElement;
  combat: CombatState;
  maxTier?: number;
  settings: SettingsType;
  icon?: string;
  ctx: QuestContext,
  custom: boolean;
}

export interface CombatDispatchProps {
  onNext: (cardName: CardName, phase: CombatPhaseNameType) => void;
  onDefeat: (cardName: CardName, maxTier: number, settings: SettingsType) => void;
  onVictory: (cardName: CardName, maxTier: number, settings: SettingsType) => void;
  onTimerStop: (cardName: CardName, elapsedMillis: number, settings: SettingsType, surge: boolean) => void;
  onPostTimerReturn: (cardName: CardName) => void;
  onTierSumDelta: (delta: number) => void;
  onAdventurerDelta: (numPlayers: number, delta: number) => void;
  onEvent: (node: XMLElement, event: string, ctx: QuestContext) => void;
  onCustomEnd: () => void;
}

export interface CombatProps extends CombatStateProps, CombatDispatchProps {};

export interface CombatResult {
  type: 'Combat';
  icon: string;
  enemies: Enemy[];
  ctx: QuestContext;
}

export function loadCombatNode(node: XMLElement, ctx: QuestContext): CombatResult {
  let enemies: Enemy[] = [];
  (new ParserNode(node, ctx)).loopChildren((tag, c) => {
    switch (tag) {
      case 'e':
        let text = c.text();
        const encounter = encounters[text.toLowerCase()];

        if (!encounter) {
          // If we don't know about the enemy, just assume tier 1.
          enemies.push({name: text, tier: 1});
        } else {
          enemies.push({name: encounter.name, tier: encounter.tier, class: encounter.class});
        }
        break;
      case 'event':
        break;
      default:
        throw new Error('Invalid child element: ' + tag);
    }
  });

  // Combat is stateless, so parser's context is not returned here.
  return {
    type: 'Combat',
    icon: node.attr('icon'),
    enemies,
    ctx,
  };
}

const numerals: {[k: number]: string;} = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
};

function renderSelectTier(props: CombatProps): JSX.Element {
  return (
    <Card title="Draw Enemies" dark={true} inQuest={true}>
      <Picker label="Tier Sum" onDelta={(i: number)=>props.onTierSumDelta(i)} value={props.combat.tier}>
        Set this to the combined tier you wish to fight.
      </Picker>
      <Button onTouchTap={() => props.onNext(props.card.name, 'PREPARE')} disabled={props.combat.tier <= 0}>Next</Button>
    </Card>
  );
}

function renderDrawEnemies(props: CombatProps): JSX.Element {
  let enemies: JSX.Element[] = props.combat.enemies.map(function(enemy: Enemy, index: number) {
    const icon = (enemy.class) ? `<img class="inline_icon" src="images/${enemy.class.replace(REGEX.HTML_TAG, '').toLowerCase()}_white_small.svg"/>` : '';
    return (
      <h2 className="combat draw_enemies center" key={index}>
        {enemy.name} <span className="meta">(Tier {numerals[enemy.tier]} <span dangerouslySetInnerHTML={{__html: icon}}/>)</span>
      </h2>
    );
  });

  let helpText: JSX.Element = <span></span>;
  if (props.settings.showHelp) {
    helpText = (
      <p>
        Draw the enemies listed above. Place in the center and put tokens on their maximum health.
      </p>
    );
  }

  return (
    <Card title="Draw Enemies" dark={true} inQuest={true}>
      <p>
        Prepare to Fight:
      </p>
      {enemies}
      {helpText}
      <Button onTouchTap={() => props.onNext(props.card.name, 'PREPARE')}>Next</Button>
    </Card>
  );
}

function renderPrepare(props: CombatProps): JSX.Element {
  let helpText: JSX.Element = (<span></span>);
  if (props.settings.showHelp) {
    helpText = (
      <ol>
        <li>Shuffle your abilities. If you don't have enough abilities to draw, shuffle in your discard pile.</li>
        <li>Draw - but don't look at - the top three.</li>
        <li>When you begin combat:</li>
        <ol>
          <li>Start the timer.</li>
          <li>Look at your hand and play one ability face up in front of you.</li>
          {props.settings.multitouch && <li>Place your finger on the screen.</li>}
          {props.settings.multitouch && <li>When all fingers are down, the timer stops.</li>}
          {!props.settings.multitouch && <li>Once everyone has selected an ability, tap the screen to stop the timer.</li>}
          <li>If the timer runs out, you'll take additional damage.</li>
        </ol>
      </ol>
    );
  }

  return (
    <Card title="Prepare for Combat" dark={true} inQuest={true}>
      {helpText}
      <Button className="bigbutton" onTouchTap={() => props.onNext(props.card.name, 'TIMER')}>Start Timer</Button>
    </Card>
  );
}

function renderSurge(props: CombatProps): JSX.Element {
  let helpText: JSX.Element = (<span></span>);
  if (props.settings.showHelp) {
    helpText = (
      <span>
        <p>
          Immediately follow the surge action listed on all remaining encounter cards. Some encounters' surges may also apply after they've been killed.
        </p>
        <p>
          Surge effects happen before abilities. Abilities that apply "this round" do not affect surges (however, loot may still be used during a surge). If you are killed during a surge, do not resolve your abilities.
        </p>
      </span>
    );
  }
  return (
    <Card title="Enemy Surge!" dark={true} inQuest={true} onReturn={() => props.onPostTimerReturn(props.card.name)}>
      <h3>An enemy surge occurs!</h3>
      {helpText}
      <Button onTouchTap={() => props.onNext(props.card.name, 'RESOLVE_ABILITIES')}>Next</Button>
    </Card>
  );
}

function renderResolve(props: CombatProps): JSX.Element {
  let helpText: JSX.Element = (<p>Resolve all played abilities.</p>);
  if (props.settings.showHelp) {
    helpText = (
      <span>
        <p>
          Roll a die for each ability with a "<img className="inline_icon" src="images/roll_white_small.svg"></img> &ge; X" and resolve the cards' effects.
        </p>
        <p>
          Adventurers may resolve their abilities in any order, and may apply their effects (such as roll and damage modifiers) retroactively to other abilities used this round.
        </p>
        <p>
          Note that some enemies take more (or less) damage from certain ability types, as specified on their card.
        </p>
        <p>
          Any abilities played this round are placed in your discard pile.
        </p>
      </span>
    );
  }
  let renderedRolls: JSX.Element[] = null;
  if (props.settings.autoRoll && props.combat.mostRecentRolls) {
    renderedRolls = props.combat.mostRecentRolls.map((roll: number, index: number) => {
      return (<div className="roll" key={index}>{roll}</div>);
    });
  }

  return (
    <Card title="Roll & Resolve" dark={true} inQuest={true} onReturn={() => props.onPostTimerReturn(props.card.name)}>
      {helpText}
      {renderedRolls &&
        <div>
          {props.settings.showHelp && <p>Resolve your abilities with the following rolls. Start with the last person to read the quest and go clockwise:</p>}
          <div className="rolls">{renderedRolls}</div>
        </div>
      }
      <Button onTouchTap={() => props.onNext(props.card.name, 'ENEMY_TIER')}>Next</Button>
    </Card>
  );
}

function renderEnemyTier(props: CombatProps): JSX.Element {
  return (
    <Card title="Enemy Strength" dark={true} inQuest={true}>
      <Picker label="Tier Sum" onDelta={(i: number)=>props.onTierSumDelta(i)} value={props.combat.tier}>
        Set this to the combined tier of the remaining enemies. You are victorious when this reaches zero.
      </Picker>

      <Button onTouchTap={() => props.onVictory(props.card.name, props.maxTier, props.settings)}>Victory (Tier = 0)</Button>
      <Button onTouchTap={() => props.onNext(props.card.name, 'PLAYER_TIER')} disabled={props.combat.tier <= 0}>Next</Button>
    </Card>
  );
}

function renderPlayerTier(props: CombatProps): JSX.Element {
  var helpText: JSX.Element = (<span></span>);
  var mostRecentAttack = props.combat.mostRecentAttack;
  var damage = (mostRecentAttack) ? mostRecentAttack.damage : -1;

  if (props.settings.showHelp) {
    helpText = (
      <span>
        <p>Slide your Adventurer health down {damage} space{damage > 1 ? 's' : ''}.</p>
        <p>If you reach zero health, you are knocked out. After resolving this turn, you cannot play further cards until you are healed by another adventurer or revived at the end of the encounter.</p>
      </span>
    );
  }

  return (
    <Card title="Take Damage" dark={true} inQuest={true}>
      <h3 className="combat center">All adventurers:</h3>
      <h3 className="combat center">{damage} Damage</h3>

      {helpText}

      <Picker label="Adventurers" onDelta={(i: number)=>props.onAdventurerDelta(props.settings.numPlayers, i)} value={props.combat.numAliveAdventurers}>
        Set this to the number of adventurers still fighting. You are defeated when this reaches zero.
      </Picker>

      <Button onTouchTap={() => props.onDefeat(props.card.name, props.maxTier, props.settings)}>Defeat (Adventurers = 0)</Button>
      <Button onTouchTap={() => props.onNext(props.card.name, 'PREPARE')} disabled={props.combat.numAliveAdventurers <= 0}>Next</Button>
    </Card>
  );
}

function renderVictory(props: CombatProps): JSX.Element {
  var contents: JSX.Element[] = [];
  let victoryParameters: EventParameters = { // default, such as during custom combat
    heal: MAX_ADVENTURER_HEALTH,
    loot: true,
    xp: true,
  };
  if (!props.custom) {
    victoryParameters = getEventParameters(props.node, 'win', props.ctx);
  }

  if (victoryParameters.heal > 0 && victoryParameters.heal < MAX_ADVENTURER_HEALTH) {
    contents.push(<p key="c1">All adventurers (dead and alive) heal <strong>{victoryParameters.heal}</strong> health.</p>);
  } else if (victoryParameters.heal === 0) {
    contents.push(<p key="c1">Adventurers <strong>do not heal</strong>.</p>);
  } else {
    contents.push(<p key="c1">All adventurers (dead and alive) heal to <strong>full</strong> health.</p>);
  }

  // TODO improved leveling up: https://github.com/Fabricate-IO/expedition-app/issues/226
  if (victoryParameters.xp !== false && props.combat.levelUp) {
    contents.push(<p key="c2">Each Adventurer may learn a new ability:</p>);
    if (props.settings.showHelp) {
      contents.push(
        <ul key="c3">
          <li>You may discard one of your current abilities.</li>
          <li>Draw 3 ability cards from one of the decks listed on your Adventurer card.</li>
          <li>Add 1 to your ability deck, and place the remaining 2 at the bottom of the deck you drew from.</li>
        </ul>
      );
    }
  }

  if (victoryParameters.loot !== false && props.combat.loot && props.combat.loot.length > 0) {
    contents.push(
      <p key="c4">The party draws the following loot:</p>
    );
    const renderedLoot = props.combat.loot.map((loot: Loot, index: number) => {
      return (<li key={index}><strong>{capitalizeFirstLetter(numberToWord(loot.count))} tier {numerals[loot.tier]} loot</strong></li>)
    });
    contents.push(<ul key="c5">{renderedLoot}</ul>);

    if (props.settings.showHelp) {
      contents.push(
        <span key="c6">
          <p>Loot should be divided amongst Adventurers now. It can be used at any time and does not cost an action (unless otherwise specified).</p>
        </span>
      );
    }
  }

  return (
    <Card title="Victory" dark={true} inQuest={true}>
      {contents}
      <Button onTouchTap={() => (props.custom) ? props.onCustomEnd() : props.onEvent(props.node, 'win', props.ctx)}>Next</Button>
    </Card>
  );
}

function renderDefeat(props: CombatProps): JSX.Element {
  var helpText = <span></span>
  if (props.settings.showHelp) {
    helpText = <p>Remember, you can adjust combat difficulty at any time in the settings menu at the top right of the app.</p>
  }

  return (
    <Card title="Defeat" dark={true} inQuest={true}>
      <p>Your party was defeated.</p>
      {helpText}
      <Button onTouchTap={() => (props.custom) ? props.onCustomEnd() : props.onEvent(props.node, 'lose', props.ctx)}>Next</Button>
    </Card>
  );
}

function renderTimerCard(props: CombatProps): JSX.Element {
  let surge: boolean = isSurgeRound(props.combat);
  return (
    <TimerCard
      dark={true}
      surgeWarning={surge}
      numPlayers={(props.settings.multitouch) ? props.combat.numAliveAdventurers : 1}
      roundTimeTotalMillis={props.combat.roundTimeMillis}
      onTimerStop={(ms: number) => props.onTimerStop(props.card.name, ms, props.settings, surge)} />
  );
}

const Combat = (props: CombatProps): JSX.Element => {
  switch(props.card.phase) {
    case 'DRAW_ENEMIES':
      return (props.custom) ? renderSelectTier(props) : renderDrawEnemies(props);
    case 'PREPARE':
      return renderPrepare(props);
    case 'TIMER':
      return renderTimerCard(props);
    case 'SURGE':
      return renderSurge(props);
    case 'RESOLVE_ABILITIES':
      return renderResolve(props);
    case 'ENEMY_TIER':
      return renderEnemyTier(props);
    case 'PLAYER_TIER':
      return renderPlayerTier(props);
    case 'VICTORY':
      return renderVictory(props);
    case 'DEFEAT':
      return renderDefeat(props);
    default:
      throw new Error('Unknown combat phase ' + props.card.phase);
  }
}

export default Combat;


