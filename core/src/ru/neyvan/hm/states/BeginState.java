package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.screens.PlayScreen;

public class BeginState extends State{

    public BeginState(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);
        Gdx.app.debug("BeginState", "Begin game with time " + time);
        core.getGame().firstNumber();
        core.getGui().displaySymbol();
        core.getGui().appear(time);


    }

    @Override
    public void end() {
        core.nextState(core.getWaitState(), core.getGame().getTimeChange());
    }
}