package ru.neyvan.hm.states;


import ru.neyvan.hm.screens.PlayScreen;

public abstract class State{
	private float time;
	protected PlayScreen core;
	public State(PlayScreen core){
		this.core = core;
	}
	public void start(float time){
		this.time = time;
	}
	public void update(float delta){
		time -= delta;
		if(time < 0) end();
	}
	public abstract void end();
	public float getLostTime(){
		return time;
	}
}