package ru.neyvan.hm.game;

import com.badlogic.gdx.Gdx;

import ru.neyvan.hm.surprises.ChangeSpeedTime;
import ru.neyvan.hm.surprises.Explosion;
import ru.neyvan.hm.surprises.FullFreezing;
import ru.neyvan.hm.surprises.GiftAndTrap;
import ru.neyvan.hm.surprises.HelpSurprise;
import ru.neyvan.hm.surprises.Surprise;

public class Symbol {
	private int number;
	private Surprise surprise;

	public Symbol(){setNumber(1);}

	public Symbol(int number){setNumber(number);}

	public Symbol(Surprise surprise){setSurprise(surprise);}

	public boolean isSurprise(){
		return surprise != null;
	}

	public void setNumber(int number){
		this.number = number;
		this.surprise = null;
	}

	public int getNumber(){
		return number;
	}

	public void setSurprise(Surprise surprise){
		this.number = Integer.MIN_VALUE;
		this.surprise = surprise;
	}

	public Surprise getSurpise(){
		return surprise;
	}

	public boolean isGoodSurprise() {
		if(surprise == null){
			Gdx.app.error("Symbol", "isGoodSurprise can't used!");
			throw new IllegalArgumentException("Now is number, no is surprise");
		}
		if(surprise instanceof Explosion || surprise instanceof FullFreezing ||
				surprise instanceof HelpSurprise) return true;
		if(surprise instanceof ChangeSpeedTime){
			ChangeSpeedTime cst = (ChangeSpeedTime)(surprise);
			if(cst.getMultiplierTime() < 1.0f) return true;
		}
		if(surprise instanceof GiftAndTrap){
			GiftAndTrap cat = (GiftAndTrap)(surprise);
			if(cat.getType() == GiftAndTrap.SUPER_LIFE || cat.getType() == GiftAndTrap.SUPER_SCORE) return true;
		}
		return false;
	}
}