package ru.neyvan.hm.impacts;

import ru.neyvan.hm.screens.PlayScreen;
import ru.neyvan.hm.surprises.Surprise;

public abstract class Impact{
	protected PlayScreen core;
	private float time;
	private Surprise surprise;

	public Impact(PlayScreen core){
		this.core = core;
	}
	public void start(Surprise surprise){
		time = surprise.getMaxTime();
		this.surprise = surprise;
	}
	public void update(float delta){
		time -= delta;
		if(time < 0) end();
	}

	public boolean isEnd(){
		return time < 0;
	}
	public abstract void end();
	
}