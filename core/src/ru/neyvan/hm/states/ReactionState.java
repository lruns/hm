package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.screens.PlayScreen;

public class ReactionState extends State {



    public ReactionState(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);
        Gdx.app.debug("ReactionState", "Begin state with time " + time);
    }

    @Override
    public void end() {
        core.getGame().nextTurn();
        core.getGui().updateDisplay(core.getGame().getTimeChange());
        core.nextState(core.getChangeState(), core.getGame().getTimeChange());
    }
}
