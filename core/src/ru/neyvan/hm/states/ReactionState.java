package ru.neyvan.hm.states;

import ru.neyvan.hm.screens.PlayScreen;

public class ReactionState extends State {



    public ReactionState(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);
    }

    @Override
    public void end() {
        core.getGame().nextTurn();
        core.getGui().updateDisplay();
        core.nextState(core.getChangeState(), core.getGame().getTimeChange());
    }
}
