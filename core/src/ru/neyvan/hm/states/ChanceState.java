package ru.neyvan.hm.states;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.screens.PlayScreen;

public class ChanceState extends State {
    private boolean addMobActivated = false;
    private boolean haveChance = false;
    public ChanceState(PlayScreen core) {
        super(core);
    }

    @Override
    public void start(float time) {
        super.start(time);
        Gdx.app.debug("ChanceState", "Begin state with time " + time);
        if(addMobActivated){
            core.getGui().giveChance();
        }else{
            Gdx.app.debug("ChanceState", "Addmob not loaded, end chance state ");
            haveChance = false;
            end();
        }

    }

    @Override
    public void end() {
        if(haveChance){
            core.getGui().hideChance();
            core.nextState(core.getWaitState(), core.getGame().getTimeWait());
        }else{
            if(addMobActivated) core.getGui().hideChance();
            core.nextState(core.getLoseState(), core.loseStateTime);
        }

    }

    public void clickAddmob(boolean watch) {
        if(watch){
            // start watch addmob
            haveChance = true;
        }else{
            haveChance = false;
        }
        end();
    }
}
