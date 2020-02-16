package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.screens.PlayScreen;

public class LoseState extends State {
    public LoseState(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);
        core.getGui().loseGame();
        Gdx.app.debug("LoseState", "Begin state with time " + time);
    }

    @Override
    public void end() {
        core.exit();
    }
}
