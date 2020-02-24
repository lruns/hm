package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.screens.PlayScreen;

public class WinState extends State {
    public WinState(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);
        core.getGui().showWin(time);
        Gdx.app.debug("WinState", "Begin state with time " + time);
    }

    @Override
    public void end() {
        if(core.getGame().isAllGameComplete())
            core.nextState(core.getAllGameCompleteState(), core.allGameCompleteStateTime);
        else if(core.getGame().isEpisodeComplete())
            core.nextState(core.getEpisodeCompleteState(), core.episodeCompleteStateTime);
        else
            core.nextState(core.getPortalState(), core.portalStateTime);
    }
}
